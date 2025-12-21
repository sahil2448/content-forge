# ContentForge 🚀

> Transform YouTube videos into ready-to-publish social media content with AI

ContentForge automates content creation by converting YouTube videos into professionally written blog posts, tweets, and LinkedIn posts using AI, complete with an email-based approval workflow.

## Problem Statement

Content creators spend hours watching videos and manually writing posts for different platforms. ContentForge solves this by automatically generating platform-optimized content from any YouTube video in minutes.

## Features

- **YouTube Transcript Extraction**: Automatically fetches video transcripts using multiple fallback strategies
- **AI Content Generation**: Creates three types of content from a single video:
  - Blog Post (150-250 words with headings)
  - Twitter/X Post (≤280 characters)
  - LinkedIn Post (professional tone with bullets and CTA)
- **Email Approval Workflow**: Review and approve content via email before publishing
- **Automatic Expiration**: Content requests expire after 24 hours for privacy
- **Status Tracking**: Monitor progress from transcript fetching to content generation

## Tech Stack

### Frontend
- **Next.js** - React framework with server-side rendering
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library

### Backend
- **Motia** - Event-driven workflow framework
- **Node.js** - Runtime environment
- **TypeScript** - Type safety
- **Zod** - Schema validation
- **Redis** - State management and persistence (via Motia)

### AI & Services
- **OpenRouter API** - AI model access (Gemini 2.0 Flash)
- **Resend** - Email delivery
- **YouTube APIs** - Transcript extraction (youtube-transcript, youtube-transcript-plus, timedtext)

### Deployment
- **Render** - Backend hosting
- **Vercel** - Frontend hosting (Next.js)

## Architecture

ContentForge uses an **event-driven architecture** powered by Motia workflows:

┌─────────────┐
│ Next.js │
│ Frontend │
└──────┬──────┘
│
▼
┌─────────────────────────────────────────┐
│ Motia Workflow Engine │
│ ┌───────────────────────────────────┐ │
│ │ 1. API Trigger (User Request) │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ 2. Process Content │ │
│ │ - Fetch Transcript │ │
│ │ - Get Video Metadata │ │
│ │ - Generate with AI │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ 3. Send Approval Email │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ 4. Wait for Approval │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ 5. Handle Approval Decision │ │
│ └───────────┬───────────────────────┘ │
│ ▼ │
│ ┌───────────────────────────────────┐ │
│ │ 6. Publish API (if approved) │ │
│ └───────────────────────────────────┘ │
└─────────────────────────────────────────┘
│
▼
┌─────────┐
│ Redis │
│ State │
└─────────┘


### Key Components

**Event Steps:**
- `api-trigger.step.ts` - Handles user requests
- `process-content.step.ts` - Fetches transcript and generates content
- `send-approval-email.step.ts` - Sends approval email via Resend
- `handle-approval.step.ts` - Processes approval/rejection decisions
- `publish-api.step.ts` - Publishes approved content
- `cleanup-expired.cron.step.ts` - Removes expired content (24h)

**State Management:**
- Redis stores request state, generated content, and approval status
- Each request has a unique `requestId` for tracking
- State persists across server restarts

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Redis (provided by Motia in development)

### Environment Variables

Create `.env` file in the root:

AI Generation
OPENROUTER_API_KEY=your_openrouter_key
OPENROUTER_MODEL=google/gemini-2.0-flash-001
OPENROUTER_SITE_URL=https://your-site.com
OPENROUTER_APP_NAME=ContentForge

Email Service
RESEND_API_KEY=your_resend_key
RESEND_FROM_EMAIL=onboarding@resend.dev

Frontend URL (for approval links)
FRONTEND_URL=http://localhost:3000


### Installation

**Install dependencies:**
npm install

**Run backend:**
npm run dev

**Run frontend (in apps/web):**
cd apps/web
npm install
npm run dev


The Next.js frontend runs on `http://localhost:3000` and the Motia backend runs on `http://localhost:10000`.

### Running in Production

- Backend deployed on **Render** with automatic deployment from GitHub
- Frontend deployed on **Vercel** (optimized for Next.js)

## How It Works

1. **User submits YouTube URL** via the Next.js frontend
2. **Transcript extraction** attempts multiple methods:
   - youtube-transcript library
   - youtube-transcript-plus
   - Direct timedtext API (manual + ASR)
3. **Content generation** using OpenRouter API:
   - Sends transcript + metadata to AI
   - Receives structured JSON with blog/tweet/LinkedIn content
4. **Email approval** sent to user with approve/reject links
5. **User clicks link** to approve or reject
6. **Content published** (if approved) or discarded (if rejected)
7. **Auto-cleanup** after 24 hours via cron job

### Technical Learnings

**Event-Driven Architecture:**
- First time working with event-driven systems using Motia
- Learned how to design loosely coupled steps that communicate via events
- Understanding state management across distributed steps

**Next.js & Modern Frontend:**
- Building production-ready Next.js applications
- Server-side rendering and API routes
- Integration with backend workflow systems

**AI Integration:**
- Integrated OpenRouter for flexible ai-model access
- Learned prompt engineering for structured JSON output
- Handling AI response parsing and validation with Zod

**Production Challenges:**
- Dealing with YouTube rate limits and transcript availability
- Implementing multiple fallback strategies for reliability
- Understanding the difference between dev and production environments

**Full-Stack Development:**
- Building a complete workflow from UI → Backend → Email → Approval
- Managing asynchronous operations and state persistence

### Personal Growth

As a chemical engineering student transitioning to software development, this project taught me:
- How to break down complex problems into manageable steps
- The importance of error handling and graceful degradation
- Working with modern frameworks and best practices
- Time management under hackathon constraints

## Known Limitations

- **Transcript Reliability**: YouTube may block transcript requests from cloud IPs in production (rate limiting/captcha)
- **Content Quality**: Generated content quality depends on transcript availability
- **Single User**: No authentication system; designed for personal use
- **Email-Only Approval**: No in-app approval interface yet
- **Publishing**: Uses a mock publish step; it doesn’t post to real social media yet(I focused more working on motia as expected from hackathon).

## 🔮 Future Enhancements

- Add user authentication and multi-user support
- Implement in-app approval workflow (remove email dependency)
- Add support for direct audio/video file uploads
- Integrate with social media APIs for one-click publishing
- Add content editing capabilities before approval
- Support for multiple languages
- Analytics dashboard for content performance
- Improve transcript reliability with alternative methods

## 📂 Project Structure

content-forge/
├── apps/
│ └── web/ # Next.js frontend
├── src/
│ ├── steps/ # Motia workflow steps
│ │ ├── api-trigger.step.ts
│ │ ├── process-content.step.ts
│ │ ├── send-approval-email.step.ts
│ │ ├── handle-approval.step.ts
│ │ └── cleanup-expired.cron.step.ts
│ ├── streaming.ts # Status streaming utilities
│ └── transcript.ts # YouTube transcript fetching
├── .env # Environment variables
├── package.json
└── README.md

## 🙏 Acknowledgments

- **Motia Team** - For the excellent event-driven framework
- **OpenRouter** - For providing unified access to AI models
- **YouTube Transcript Libraries** - youtube-transcript, youtube-transcript-plus
- **Vercel** - For seamless Next.js deployment


