
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlmodel import select
from sqlalchemy.ext.asyncio import AsyncSession
from models import Lead, User, Campaign
from database import get_session
from auth_utils import get_current_user
from schemas import LeadOut, LeadListResponse
from typing import List
import csv
from io import StringIO
from collections import defaultdict
import os
import requests
import time
import logging
from fastapi.responses import StreamingResponse
from datetime import datetime

router = APIRouter(prefix="/leads", tags=["leads"])

# Import subscription plans
from routers.subscriptions import SUBSCRIPTION_PLANS


# Enhanced upload: deduplication, validation, Hunter.io enrichment
@router.post("/upload")
async def upload_leads(req: dict, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    plan = SUBSCRIPTION_PLANS.get(user.subscription_tier, SUBSCRIPTION_PLANS["free"])
    limit = plan["leads_limit"]
    campaign_id = int(req.get("campaignId", "1"))
    campaign_result = await session.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    leads_result = await session.execute(select(Lead).join(Campaign).where(Campaign.user_id == user.id))
    existing_leads = leads_result.scalars().all()
    leads_count = len(existing_leads)
    warning_threshold = limit * 0.8
    is_near_limit = leads_count >= warning_threshold
    is_over_limit = leads_count >= limit
    if is_over_limit:
        return {
            "message": f"Upload completed, but you've reached your {user.subscription_tier} plan limit of {limit} leads. Consider upgrading for more capacity.",
            "leads_created": 0,
            "warning": "limit_reached",
            "current_usage": leads_count,
            "limit": limit,
            "upgrade_required": True
        }
    csv_data = req.get("csvData", "")
    if not csv_data:
        raise HTTPException(status_code=400, detail="No CSV data provided")
    leads_created = 0
    reader = csv.DictReader(StringIO(csv_data))
    required_columns = {"first_name", "last_name", "company", "profile_url", "job_title"}
    missing_columns = required_columns - set(reader.fieldnames or [])
    if missing_columns:
        return {
            "message": f"CSV missing required columns: {', '.join(missing_columns)}",
            "leads_created": 0,
            "current_usage": leads_count,
            "limit": limit,
            "warning": "csv_invalid"
        }
    deduped = set((l.first_name, l.last_name, l.company, l.profile_url) for l in existing_leads)
    for row in reader:
        key = (row.get("first_name", ""), row.get("last_name", ""), row.get("company", ""), row.get("profile_url", ""))
        if key in deduped:
            continue  # skip duplicate
        if leads_created + leads_count >= limit:
            break
        lead = Lead(
            first_name=row.get("first_name", ""),
            last_name=row.get("last_name", ""),
            job_title=row.get("job_title", ""),
            company=row.get("company", ""),
            profile_url=row.get("profile_url", ""),
            status="pending",
            campaign_id=campaign_id
        )
        session.add(lead)
        leads_created += 1
        deduped.add(key)
    await session.commit()
    response = {
        "message": f"Successfully uploaded {leads_created} leads",
        "leads_created": leads_created,
        "current_usage": leads_count + leads_created,
        "limit": limit
    }
    if is_near_limit and not is_over_limit:
        response["warning"] = "approaching_limit"
        response["message"] += f". You're approaching your {user.subscription_tier} plan limit ({leads_count + leads_created}/{limit} leads)."
    return response

# Hunter.io enrichment endpoint
enrichment_cache = defaultdict(dict)  # { (first_name, last_name, company): {"email":..., "confidence":...} }

# Simple in-memory cache
enrichment_cache = {}

@router.post("/enrich-email")
async def enrich_lead_email(
    req: dict,
    session: AsyncSession = Depends(get_session),
    user: User = Depends(get_current_user)
):
    lead_id = req.get("leadId")
    if not lead_id:
        raise HTTPException(status_code=400, detail="leadId required")

    # Fetch lead and ensure it belongs to user
    result = await session.execute(
        select(Lead).join(Campaign).where(Lead.id == lead_id, Campaign.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    # Return if email already exists
    if getattr(lead, "email", None):
        return {"message": "Lead already has email", "email": lead.email}

    # Check cache
    cache_key = (lead.first_name, lead.last_name, lead.company)
    if cache_key in enrichment_cache:
        cached = enrichment_cache[cache_key]
        if cached.get("email"):
            lead.email = cached["email"]
            lead.email_confidence = cached.get("confidence", 0)
            session.add(lead)
            await session.commit()
            return {"email": lead.email, "confidence": lead.email_confidence, "cached": True}

    # Use Apollo.io API
    APOLLO_API_KEY = user.apollo_api_key
    if not APOLLO_API_KEY:
        raise HTTPException(status_code=500, detail="Apollo API key not configured for this user")

    url = "https://api.apollo.io/v1/people/match"  # Apollo enrichment endpoint
    headers = {"Authorization": f"Bearer {APOLLO_API_KEY}", "Content-Type": "application/json"}
    payload = {
        "first_name": lead.first_name,
        "last_name": lead.last_name,
        "company": lead.company
    }

    max_retries = 3
    backoff = 2
    for attempt in range(max_retries):
        try:
            resp = requests.post(url, json=payload, headers=headers, timeout=10)
            if resp.status_code == 429:
                logging.warning(f"Apollo rate limit hit for user {user.id}. Attempt {attempt+1}/{max_retries}.")
                if attempt < max_retries - 1:
                    time.sleep(backoff ** attempt)
                    continue
                else:
                    notification = Notification(
                        user_id=user.id,
                        type="enrichment_failed",
                        message=f"Apollo rate limit exceeded for lead {lead.first_name} {lead.last_name}.",
                        created_at=datetime.utcnow()
                    )
                    session.add(notification)
                    await session.commit()
                    raise HTTPException(status_code=429, detail="Apollo rate limit exceeded. Try later.")
            data = resp.json()
            if "person" in data and "email" in data["person"]:
                lead.email = data["person"]["email"]
                lead.email_confidence = data["person"].get("confidence", 0)
                session.add(lead)
                await session.commit()
                enrichment_cache[cache_key] = {"email": lead.email, "confidence": lead.email_confidence}
                return {"email": lead.email, "confidence": lead.email_confidence}
            else:
                enrichment_cache[cache_key] = {"email": None, "confidence": None}
                return {"message": "No email found via Apollo.io."}
        except Exception as e:
            logging.error(f"Apollo.io error for user {user.id}: {str(e)}")
            if attempt == max_retries - 1:
                notification = Notification(
                    user_id=user.id,
                    type="enrichment_failed",
                    message=f"Apollo.io error for lead {lead.first_name} {lead.last_name}: {str(e)}",
                    created_at=datetime.utcnow()
                )
                session.add(notification)
                await session.commit()
                raise HTTPException(status_code=500, detail=f"Apollo.io error: {str(e)}")
            time.sleep(backoff ** attempt)


@router.get("/list", response_model=LeadListResponse)
async def list_leads(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user), unassigned: bool = False):
    plan = SUBSCRIPTION_PLANS.get(user.subscription_tier, SUBSCRIPTION_PLANS["free"])
    limit = plan["leads_limit"]
    query = select(Lead).join(Campaign, isouter=True).where(Campaign.user_id == user.id)
    if unassigned:
        query = query.where(Lead.campaign_id == None)
    result = await session.execute(query.limit(limit))
    leads = result.scalars().all()
    return {"leads": leads}

@router.put("/{lead_id}")
async def update_lead(lead_id: int, req: dict, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    # Get lead and verify it belongs to user
    result = await session.execute(
        select(Lead)
        .join(Campaign)
        .where(Lead.id == lead_id, Campaign.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    status_before = lead.status
    if "status" in req:
        lead.status = req["status"]
    session.add(lead)
    await session.commit()
    # Notification trigger for lead update
    if status_before != lead.status:
        from models import Notification
        notification = Notification(
            user_id=user.id,
            type="lead_updated",
            message=f"Lead '{lead.first_name} {lead.last_name}' status updated to '{lead.status}'.",
            created_at=datetime.utcnow()
        )
        session.add(notification)
        await session.commit()
    return {"message": "Lead updated"}

@router.delete("/{lead_id}")
async def delete_lead(lead_id: int, session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    # Get lead and verify it belongs to user
    result = await session.execute(
        select(Lead)
        .join(Campaign)
        .where(Lead.id == lead_id, Campaign.user_id == user.id)
    )
    lead = result.scalar_one_or_none()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    await session.delete(lead)
    await session.commit()
    return {"message": "Lead deleted"}

import asyncio
import httpx
from models import User, Notification
from database import get_session


router = APIRouter()

@router.post("/scrape-linkedin-leads")
async def scrape_linkedin_leads(
    req: dict = Body(...),
    user: User = Depends(get_current_user)
):
    # 1. Pick API key from user record or fallback env
    apollo_key = "OK32YqkeuWZ2XII25SG_7A"
    if not apollo_key:
        raise HTTPException(status_code=400, detail="Apollo API key not configured.")

    url = "https://api.apollo.io/api/v1/mixed_people/search"
    headers = {
    "accept": "application/json",
    "Cache-Control": "no-cache",
    "Content-Type": "application/json",
    "x-api-key": apollo_key
}


    # 2. Build payload
    payload = {
        "page": req.get("page", 1),
        "per_page": req.get("per_page", 20),
    }
    if req.get("currentCompany"):
        payload["q_organization_keywords"] = req["currentCompany"]
    if req.get("job_title"):
        payload["person_titles"] = req["job_title"]
    if req.get("location"):
        payload["person_locations"] = req["location"]
    if req.get("keywords"):
        payload["q_keywords"] = req["keywords"]
    if req.get("industry"):
        payload["industry_tag_ids"] = req["industry"]

    max_retries = 3
    backoff = 2

    async with httpx.AsyncClient(timeout=30.0) as client:
        for attempt in range(max_retries):
            try:
                response = await client.post(url, headers=headers, json=payload)

                if response.status_code == 429:
                    logging.warning(f"Apollo rate limit, attempt {attempt + 1}")
                    if attempt < max_retries - 1:
                        await asyncio.sleep(backoff ** attempt)
                        continue
                    raise HTTPException(status_code=429, detail="Apollo rate limit exceeded.")

                if response.status_code == 422:
                    err = response.json().get("message") or response.text
                    raise HTTPException(status_code=422, detail=f"Apollo error: {err}")

                response.raise_for_status()
                return {
                    "message": "Apollo lead scrape triggered",
                    "apollo_response": response.json()
                }

            except httpx.RequestError as e:
                logging.error(f"Apollo request error: {e}")
                if attempt == max_retries - 1:
                    raise HTTPException(status_code=500, detail=f"Apollo request error: {e}")
                await asyncio.sleep(backoff ** attempt)


@router.post("/assign-to-campaign")
async def assign_leads_to_campaign(req: dict = Body(...), session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user)):
    lead_ids = req.get("leadIds", [])
    campaign_id = req.get("campaignId")
    if not lead_ids or not campaign_id:
        raise HTTPException(status_code=400, detail="leadIds and campaignId are required")
    # Check campaign ownership
    campaign_result = await session.execute(select(Campaign).where(Campaign.id == campaign_id, Campaign.user_id == user.id))
    campaign = campaign_result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")
    # Assign leads
    leads_result = await session.execute(select(Lead).where(Lead.id.in_(lead_ids), Lead.campaign_id == None))
    leads = leads_result.scalars().all()
    for lead in leads:
        lead.campaign_id = campaign_id
        session.add(lead)
    await session.commit()
    # Notification trigger for lead assignment
    if leads:
        from models import Notification
        notification = Notification(
            user_id=user.id,
            type="lead_assigned",
            message=f"{len(leads)} leads assigned to campaign '{campaign.name}'.",
            created_at=datetime.utcnow()
        )
        session.add(notification)
        await session.commit()
    return {"message": f"Assigned {len(leads)} leads to campaign"}

@router.get("/export")
async def export_leads(session: AsyncSession = Depends(get_session), user: User = Depends(get_current_user), unassigned: bool = False):
    query = select(Lead).join(Campaign, isouter=True).where(Campaign.user_id == user.id)
    if unassigned:
        query = query.where(Lead.campaign_id == None)
    result = await session.execute(query)
    leads = result.scalars().all()
    # Prepare CSV
    output = StringIO()
    writer = csv.writer(output)
    writer.writerow(["First Name", "Last Name", "Job Title", "Company", "Profile URL", "Status", "Email", "Email Confidence"])
    for lead in leads:
        writer.writerow([
            lead.first_name,
            lead.last_name,
            lead.job_title,
            lead.company,
            lead.profile_url,
            lead.status,
            getattr(lead, "email", ""),
            getattr(lead, "email_confidence", "")
        ])
    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": "attachment; filename=leads.csv"})
