# LinkedIn Outreach Automation Platform

## Overview

LinkedLeads is a comprehensive LinkedIn outreach automation platform that enables users to manage leads, create campaigns, and generate AI-powered personalized messages for LinkedIn outreach. The application provides a full-stack solution with user authentication, campaign management, lead tracking, and OpenAI integration for message generation.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**React with TypeScript**: The client-side application is built using React with TypeScript, providing type safety and modern component-based architecture.

**UI Framework**: Uses shadcn/ui component library built on top of Radix UI primitives, providing accessible and customizable components with Tailwind CSS for styling.

**State Management**: Implements TanStack Query (React Query) for server state management, providing caching, synchronization, and background updates for API data.

**Routing**: Uses Wouter for lightweight client-side routing with protected routes that require authentication.

**Authentication Flow**: Client-side authentication context manages user state and provides login/logout functionality with automatic redirects.

### Backend Architecture

**Express.js Server**: Node.js backend using Express.js framework with TypeScript support for API endpoints and middleware.

**Session-based Authentication**: Implements Passport.js with local strategy for user authentication, using express-session with PostgreSQL session store for persistence.

**Password Security**: Uses Node.js crypto module with scrypt for secure password hashing with salt.

**API Design**: RESTful API endpoints organized in a routes module with proper error handling and request logging middleware.

**File Upload Processing**: CSV parsing capabilities for bulk lead imports using csv-parse library.

### Data Storage Solutions

**PostgreSQL Database**: Primary database using Neon serverless PostgreSQL for scalable cloud hosting.

**ORM**: Drizzle ORM for type-safe database operations with schema-first approach and automatic type generation.

**Database Schema**: 
- Users table with subscription tiers and authentication data
- Campaigns table for organizing outreach efforts
- Leads table for prospect information and status tracking
- Outreach logs table for activity tracking and analytics

**Session Storage**: PostgreSQL-backed session storage using connect-pg-simple for persistent user sessions.

### Authentication and Authorization

**Passport.js Integration**: Local strategy authentication with email/password credentials.

**Session Management**: Server-side sessions with secure cookie configuration and PostgreSQL persistence.

**Route Protection**: Both client-side and server-side route protection ensuring authenticated access to protected resources.

**User Context**: React context provider for managing authentication state across the application.

### AI Integration

**OpenAI Integration**: Uses OpenAI's GPT-4o-mini model for generating personalized LinkedIn connection messages.

**Message Personalization**: AI service takes lead information and tone preferences to generate contextually relevant outreach messages.

**Error Handling**: Robust error handling with fallback messages when AI generation fails.

## External Dependencies

**Database**: Neon serverless PostgreSQL for cloud-hosted database with connection pooling

**AI Services**: OpenAI API for GPT-4o-mini model access for message generation

**UI Components**: shadcn/ui component library built on Radix UI primitives for accessible interface components

**Authentication**: Passport.js with local strategy for user authentication and session management

**Development Tools**: 
- Vite for fast development server and build tooling
- Replit-specific plugins for development environment integration
- ESBuild for production bundling

**Styling**: Tailwind CSS for utility-first styling with CSS custom properties for theming

**State Management**: TanStack Query for server state management and caching

**Routing**: Wouter for lightweight client-side routing

**Form Handling**: React Hook Form with Zod validation for type-safe form management

**CSV Processing**: csv-parse library for handling bulk lead data imports

**Icons**: Lucide React for consistent iconography

**Fonts**: Google Fonts integration (Inter, DM Sans, Fira Code, Geist Mono, Architects Daughter)