# Vertex AI Load Balancer

A modern NextJS application that serves as an OpenAI-compatible API load balancer specifically for Google Cloud Vertex AI backends. It provides target management, load balancing, and a UI to monitor usage and configure settings. This application allows you to efficiently manage multiple Vertex AI targets (Project ID, Location, Model ID, Service Account Key), automatically rotate between them, and monitor API usage with detailed statistics.

![Vertex AI Load Balancer](https://cloud.google.com/static/vertex-ai/docs/generative-ai/images/architecture-for-llm-custom-model-training-and-serving.svg) <!-- Placeholder image, consider updating -->

Thanks to @SannidhyaSah for the original OpenAI-compatible load balancer foundation.

## Features

- **Vertex AI Target Management**: Add, remove, and monitor your Vertex AI targets (Project ID, Location, Model ID, Service Account Key JSON).
- **Load Balancing**: Automatically rotate between active Vertex AI targets based on request count.
- **Usage Statistics**: Monitor your Vertex AI API usage with detailed charts and metrics per target (requests, errors, response time, token counts).
- **Logs Viewer**: View and search through request, error, and target management logs.
- **Dark/Light Mode**: Toggle between dark and light themes.
- **Single Command Execution**: Run both frontend and backend with a single command.
- **Security Features**: Service Account Key handling (stored in DB, masked in UI), target failure detection.
- **Responsive Design**: Works seamlessly on desktop and mobile devices.
- **Real-time Monitoring**: Live updates of target status and usage metrics.
- **Customizable Settings**: Configure target rotation, max failures, log retention, etc.
- **Import/Export Targets**: Backup and restore your Vertex AI targets via JSON files.

## Architecture

The Vertex AI Load Balancer is built using Next.js App Router, providing a unified application for the frontend UI and backend API routes.

- **Frontend**: React with Chakra UI and Tailwind CSS for a responsive and accessible interface.
- **Backend**: Next.js API routes that proxy requests to the appropriate Google Cloud Vertex AI endpoint based on the selected target. Uses `@google-cloud/vertexai`.
- **State Management**: React Context API + SWR for data fetching.
- **Data Storage**: SQLite database (`data/database.db`) for Vertex AI targets (`vertex_targets` table), application settings, and detailed request logs (`request_logs` table including token counts). File-based storage (`logs/`) for supplementary debugging logs (requests, errors, target events). Statistics are derived from the database.
- **Styling**: Chakra UI with Tailwind CSS.
- **Error Handling**: Comprehensive error logging and monitoring.
- **Type Safety**: Full TypeScript implementation.

## Prerequisites

- Node.js 18+ or Bun runtime (Recommended)
- Git (for version control)
- Google Cloud Project with Vertex AI API enabled.
- Service Account(s) with appropriate Vertex AI permissions (e.g., "Vertex AI User" role). You will need the JSON key file for each service account you want to use as a target.

## Installation

Make sure you have Node.js and Bun installed. Then, clone the repository and install the dependencies:

```bash
# Clone the repository (Update URL if necessary)
git clone https://github.com/shariqriazz/vertex-ai-load-balancer.git # Or your repo URL
cd vertex-ai-load-balancer

# Install dependencies (choose one)
bun install
# OR
npm install --legacy-peer-deps # Use if you encounter peer dependency issues
```

## Configuration

The application requires minimal configuration via environment variables:

1.  Run `bun run generate:env` to create a `.env.local` file with secure defaults, or create it manually (copy from `.env.example`).
2.  Review and potentially modify the generated values in `.env.local`.

```env
# .env.local (Example generated content)

# Admin Login
# Password to access the admin dashboard
ADMIN_PASSWORD=generated_secret_admin_password # Generated at ...
# This password is also used to encrypt sensitive data like session information.

# Optional Admin Login Enforcement
# Set to 'false' to disable the admin login requirement for the entire application.
# Set to 'true' or leave blank to enforce admin login.
REQUIRE_ADMIN_LOGIN=true

# Master API Key for Incoming Requests (Optional)
# If set, this single key MUST be provided as a Bearer token in the Authorization header
# for incoming requests to the /api/v1/chat/completions endpoint.
# This adds an authentication layer to YOUR API endpoint, separate from Vertex AI auth.
# Leave blank to skip this specific incoming authentication check.
MASTER_API_KEY=generated_master_api_key # Generated at ...
```

Note: The application runs on port 4269 by default. Modify `package.json` scripts to change the port.

**Important:** Vertex AI Targets (Project ID, Location, Model ID, Service Account Key JSON) and rotation settings are managed entirely through the UI (stored in the `data/database.db` SQLite database), not in the `.env` file.

### Adding Vertex AI Targets

1.  Start the application (`bun run dev`) and log in to the admin dashboard (default user: `admin`, password from `.env.local`).
2.  Navigate to the **Targets** page.
3.  Click **Add Target**.
4.  Fill in the required details:
    *   **Name:** A friendly name for the target (e.g., "Gemini-Pro-US-Central1").
    *   **Project ID:** Your Google Cloud Project ID.
    *   **Location:** The Google Cloud region for your Vertex AI endpoint (e.g., `us-central1`).
    *   **Model ID:** The specific Vertex AI model you want to target (e.g., `gemini-2.5-pro-exp-03-25`).
    *   **Service Account Key:** Upload the JSON key file for the service account that has permissions to access Vertex AI in the specified project and location. The JSON content will be stored in the database.
5.  Configure optional settings like `isActive` and daily rate limits.
6.  Click **Save**.

Repeat this process for each Vertex AI backend you want to load balance across.

## Recommended Settings

For optimal performance and reliability:

### Vertex Target Management

- Add multiple targets across different regions or models if needed for resilience or specific use cases.
- Ensure the Service Account Keys used have the minimum necessary permissions.
- Regularly review target performance in the **Stats** page and deactivate or remove underperforming/erroring targets.

### Performance Settings (via Settings Page)

- Configure target rotation request count (e.g., rotate after 5 requests per target).
- Set appropriate cooldown periods for rate-limited targets.
- Configure max failure count before a target is automatically deactivated.

### Monitoring

- Check the dashboard daily for target health and overall request volume.
- Review error logs periodically, filtering by target if necessary.
- Monitor target usage distribution for balance.
- Keep track of error rates and latency for each target.

### Best Practices

- Rotate Service Account Keys periodically as per your organization's security policy.
- Keep the total request volume within your Vertex AI quotas.
- Use descriptive names for your targets.

### Resource Management

- Configure log retention (e.g., 14-30 days) via the **Settings** page to manage database size.
- Regularly backup your `data/database.db` file.

## Running the Application

**Important:** Before the first run after cloning or after major schema changes, delete any existing database file: `rm data/database.db`. The application will create a new one.

Development mode with hot reloading:

```bash
# Generate environment file (if not done already)
bun run generate:env

# Start development server
bun run dev
```

Production deployment:

```bash
# Build the application
bun run build

# Start the production server
bun run start
```

The application will be available at http://localhost:4269 (or your configured PORT).

Using PM2 for process management:

```bash
# Ensure pm2 is installed globally (e.g., npm install -g pm2 or bun install -g pm2)

# Start the application using pm2 with bun
pm2 start bun --name vertex-ai-lb -- start # Use a descriptive name

# OR Start the application using pm2 with npm
# pm2 start npm --name vertex-ai-lb -- run start

# Monitor the application
# pm2 list
# pm2 logs vertex-ai-lb
```

## Security Considerations

1.  **Service Account Key Protection**:
    - Service Account Key JSON content is stored as plain text within the SQLite database (`data/database.db`). Ensure appropriate file system permissions for this file and the `data/` directory to restrict access.
    - Key content is masked in the UI and logs where possible. Never expose the full key content unnecessarily.
    - Access to the admin panel (where targets are managed) is protected by the `ADMIN_PASSWORD` set in the `.env.local` file. This password also encrypts session information. Choose a strong, unique password.
    - Regularly rotate your `ADMIN_PASSWORD` and Service Account Keys.

2.  **Rate Limiting & Quotas**:
    - Be aware of Vertex AI API quotas for your project and models. This load balancer helps distribute load but doesn't bypass fundamental quotas.
    - The application attempts to handle Vertex AI rate limit errors (Resource Exhausted) by placing the affected target in a cooldown period defined in the settings.

3.  **Error Handling**:
    - Failed targets (due to invalid credentials, permissions, quota issues, etc.) are automatically disabled after a configurable number of failures (`maxFailureCount` in settings).
    - Comprehensive error logging helps diagnose issues with specific targets.

4.  **Incoming Request Authentication**:
    - Use the optional `MASTER_API_KEY` environment variable to add a layer of authentication for clients calling *this* load balancer's API endpoint (`/api/v1/chat/completions`). This is separate from the Vertex AI authentication handled by the Service Account Keys. If set, clients must provide `Authorization: Bearer <MASTER_API_KEY>`.

## Using as an API Service

To use this load balancer as an OpenAI-compatible API endpoint for your applications, pointing to your Vertex AI backends:

1.  Start the application and access the UI at http://localhost:4269 (or your deployed URL).
2.  Go to the **Targets** section and add your Vertex AI targets (Project ID, Location, Model ID, SA Key JSON) through the UI. Ensure they are marked as active.
3.  In your client application (the one making OpenAI-style API calls), configure the following:
    - **Base URL:** `http://localhost:4269/api/v1` (or the URL where you deployed this load balancer).
    - **API Key / Authorization Header:**
      - If `MASTER_API_KEY` is set in the load balancer's `.env.local` file, your client application **must** include the header `Authorization: Bearer <MASTER_API_KEY>` in its requests to the load balancer.
      - If `MASTER_API_KEY` is **not** set (left blank) in the load balancer's `.env.local` file, your client can typically send *any* non-empty string as the API key (e.g., `apiKey: "dummy-key"`), as the load balancer itself handles the actual authentication to Vertex AI using the managed Service Account Keys. The specific requirement might depend on the OpenAI client library you use.
    - **Model:** You can specify *any* model name in your client request (e.g., `gpt-4`, `claude-3`). The load balancer will ignore this model name and route the request to one of its active Vertex AI targets based on its internal rotation logic. The actual model used will be the one configured in the chosen Vertex AI target (e.g., `gemini-2.5-pro-exp-03-25`).

Example client configuration (using a generic OpenAI library concept):

```javascript
// Example using a hypothetical OpenAI client library
const openai = new OpenAI({
  baseURL: "http://localhost:4269/api/v1", // Point to YOUR load balancer
  apiKey: "YOUR_MASTER_API_KEY_IF_SET_ON_SERVER", // Or "dummy-key" if MASTER_API_KEY is not set
  // dangerouslyAllowBrowser: true, // If running in a browser context (use with caution)
});

async function main() {
  const chatCompletion = await openai.chat.completions.create({
    messages: [{ role: "user", content: "Explain the theory of relativity." }],
    model: "ignored-by-load-balancer", // This model name is disregarded by the LB
    // The actual model used will be from the selected Vertex AI target (e.g., gemini-2.5-pro-exp-03-25)
  });
  console.log(chatCompletion.choices[0].message);
}

main();
```

The load balancer handles selecting an active Vertex AI target (based on rotation settings) and forwarding the request using that target's credentials and configured model.

## Development

### Project Structure

```
vertex-ai-load-balancer/
├── data/                        # Data storage (SQLite DB, ensure writable)
│   └── database.db            # SQLite database for targets, settings, logs
├── logs/                        # File-based logs (ensure writable)
├── scripts/                     # Utility scripts (e.g., generate-env)
├── public/                      # Static assets
├── src/                         # Source code
│   ├── app/                     # Next.js App Router
│   │   ├── api/                 # API routes
│   │   │   ├── admin/           # Admin API endpoints
│   │   │   │   ├── targets/     # Target management (CRUD, Import, Export, Bulk)
│   │   │   │   ├── cleanup-logs/ # Log cleanup endpoint
│   │   │   │   └── data/        # Data export/import (targets + settings)
│   │   │   ├── login/           # Auth endpoints
│   │   │   ├── logout/
│   │   │   ├── logs/            # Logs API endpoint (fetch from files)
│   │   │   ├── settings/        # Settings API endpoint
│   │   │   ├── stats/           # Statistics API endpoint (DB-driven)
│   │   │   └── v1/              # OpenAI Compatible API proxy endpoints
│   │   │       ├── chat/        # Chat completions proxy
│   │   │       └── models/      # Models endpoint (returns unique target names)
│   │   ├── dashboard/           # Dashboard page
│   │   ├── login/               # Login page
│   │   ├── logs/                # Logs viewer page
│   │   ├── settings/            # Settings page
│   │   ├── stats/               # Statistics page
│   │   └── targets/             # Target management page
│   ├── components/              # React components (UI elements)
│   ├── contexts/                # React contexts (e.g., ThemeContext)
│   ├── lib/                     # Core library code
│   │   ├── models/              # Data models (VertexTarget, RequestLog)
│   │   ├── services/            # Business logic (targetManager, logger)
│   │   ├── utils/               # Utility functions
│   │   ├── db.ts                # Database connection setup
│   │   ├── session.ts           # Session management (iron-session)
│   │   └── settings.ts          # Settings management
│   └── middleware.ts            # Next.js middleware (auth checks)
├── .env.example                 # Example environment variables
├── .gitignore
├── next-env.d.ts
├── next.config.js
├── package.json
├── postcss.config.js
├── README.md                    # This file
├── tailwind.config.js
└── tsconfig.json
```

### Adding Features

1.  **Frontend Components**: Add new components in `src/components`.
2.  **API Routes**: Add new API routes in `src/app/api`.
3.  **Pages**: Add new pages/routes in `src/app`.
4.  **Models/Services**: Update or add models in `src/lib/models` and services in `src/lib/services`.

### Technology Stack

- **Framework**: Next.js 14+ (App Router)
- **UI Library**: Chakra UI with Tailwind CSS
- **State Management**: React Context API + SWR for data fetching
- **API Communication**: Built-in Next.js API routes + `@google-cloud/vertexai` for Vertex AI calls
- **Charts**: Recharts
- **Database**: SQLite (via `sqlite` and `sqlite3` packages)
- **Authentication**: `iron-session`
- **Concurrency**: `async-mutex`
- **Logging**: `winston`, `winston-daily-rotate-file`
- **Package Manager**: Bun (Recommended)
- **Styling**: Chakra UI + Tailwind CSS
- **Icons**: React Icons
- **Language**: TypeScript

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

ISC
