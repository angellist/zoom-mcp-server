# Zoom MCP Server

MCP server for the Zoom API. 35 tools covering users, meetings, webinars, recordings, reports, analytics, and groups.

## Setup

Install dependencies:

```sh
npm install
```

Build:

```sh
npm run build
```

## Zoom App Configuration

### Server-to-Server OAuth (recommended)

This is the recommended approach. It lets the server acquire access tokens automatically without user interaction.

#### 1. Create a Zoom Developer account

If you don't have one, sign up at [marketplace.zoom.us/develop](https://marketplace.zoom.us/develop).

#### 2. Create a Server-to-Server OAuth app

1. Go to [marketplace.zoom.us](https://marketplace.zoom.us/) and sign in
2. Click **Develop** in the top-right dropdown and select **Build App**
3. Choose **Server-to-Server OAuth** as the app type
4. Give the app a name (e.g. "MCP Server") and click **Create**

#### 3. Copy your credentials

On the **App Credentials** page you'll see three values:

| Field | Environment Variable |
|-------|---------------------|
| Account ID | `ZOOM_ACCOUNT_ID` |
| Client ID | `ZOOM_CLIENT_ID` |
| Client Secret | `ZOOM_CLIENT_SECRET` |

#### 4. Add required scopes

Go to the **Scopes** tab and add the scopes your tools need. The table below maps scopes to tool categories:

| Scope | Grants access to |
|-------|-----------------|
| `user:read:admin` | `zoom_list_users`, `zoom_get_user` |
| `user:write:admin` | `zoom_create_user`, `zoom_update_user`, `zoom_delete_user` |
| `meeting:read:admin` | `zoom_list_meetings`, `zoom_get_meeting`, `zoom_get_past_meeting`, `zoom_get_past_meeting_participants`, `zoom_list_meeting_registrants` |
| `meeting:write:admin` | `zoom_create_meeting`, `zoom_update_meeting`, `zoom_delete_meeting`, `zoom_end_meeting` |
| `webinar:read:admin` | `zoom_list_webinars`, `zoom_get_webinar`, `zoom_list_webinar_registrants` |
| `webinar:write:admin` | `zoom_create_webinar`, `zoom_update_webinar`, `zoom_delete_webinar` |
| `recording:read:admin` | `zoom_list_recordings`, `zoom_get_meeting_recordings` |
| `recording:write:admin` | `zoom_delete_meeting_recordings`, `zoom_delete_recording_file`, `zoom_recover_meeting_recordings` |
| `report:read:user:admin` | `zoom_list_user_meeting_reports`, `zoom_list_all_user_reports`, `zoom_get_daily_usage_report` |
| `report:read:list_meeting_participants:admin` | `zoom_get_meeting_participant_report` |
| `dashboard:read:list_meeting_participants:admin` | `zoom_get_meeting_quality` |
| `group:read:admin` | `zoom_list_groups`, `zoom_get_group_members` |

Add only the scopes you need. For full access to all 35 tools, add all scopes above.

#### 5. Activate the app

Click **Activate** on the **Activation** tab. The app is now ready to use.

#### 6. Set environment variables

```sh
export ZOOM_ACCOUNT_ID=your_account_id
export ZOOM_CLIENT_ID=your_client_id
export ZOOM_CLIENT_SECRET=your_client_secret
```

The server handles OAuth token generation and refresh automatically.

### Static Bearer Token (alternative)

If you already have an access token (e.g. from an existing OAuth flow), pass it directly:

```sh
export ZOOM_API_TOKEN=your_token
```

This is simpler but requires you to manage token expiration yourself. Tokens expire after 1 hour.

## Running

**Streamable HTTP (default)**

```sh
npm start
# Listening on http://localhost:3000/mcp
```

**stdio mode**

```sh
MCP_TRANSPORT=stdio npm start
```

**Development with auto-reload**

```sh
npm run dev
```

## Cursor Integration

Add to your `.mcp.json`:

```json
{
  "mcpServers": {
    "zoom": {
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Or for stdio mode:

```json
{
  "mcpServers": {
    "zoom": {
      "command": "node",
      "args": ["/path/to/zoom-mcp-server/dist/index.js"],
      "env": {
        "MCP_TRANSPORT": "stdio",
        "ZOOM_ACCOUNT_ID": "...",
        "ZOOM_CLIENT_ID": "...",
        "ZOOM_CLIENT_SECRET": "..."
      }
    }
  }
}
```

## Tools

### Users (7 tools)
| Tool | Description |
|------|-------------|
| `zoom_list_users` | List users on the account (paginated) |
| `zoom_get_user` | Get user details by ID or email |
| `zoom_search_users` | Search users by name or email |
| `zoom_get_user_settings` | Get a user's Zoom settings (meeting defaults, recording prefs, etc.) |
| `zoom_create_user` | Create a new user |
| `zoom_update_user` | Update user profile |
| `zoom_delete_user` | Delete or disassociate a user |

### Meetings (10 tools)
| Tool | Description |
|------|-------------|
| `zoom_list_meetings` | List meetings hosted by a user (paginated) |
| `zoom_get_meeting` | Get meeting details |
| `zoom_create_meeting` | Create a meeting |
| `zoom_update_meeting` | Update a meeting |
| `zoom_delete_meeting` | Delete a meeting |
| `zoom_end_meeting` | End a live meeting |
| `zoom_list_meeting_registrants` | List meeting registrants (paginated) |
| `zoom_get_past_meeting` | Get past meeting details |
| `zoom_get_past_meeting_participants` | List past meeting participants |
| `zoom_list_user_meeting_reports` | List all meetings a user attended (hosted + joined) in a date range |

### Reports & Analytics (4 tools)
| Tool | Description |
|------|-------------|
| `zoom_get_meeting_participant_report` | Detailed participant report with device, location, IP, attentiveness |
| `zoom_list_all_user_reports` | Account-wide user activity (meetings, minutes, last login) |
| `zoom_get_daily_usage_report` | Daily account-level stats (meetings, participants, minutes) |
| `zoom_get_meeting_quality` | QoS data: audio/video bitrate, latency, jitter, packet loss |

### Webinars (7 tools)
| Tool | Description |
|------|-------------|
| `zoom_list_webinars` | List webinars for a user (paginated) |
| `zoom_get_webinar` | Get webinar details |
| `zoom_create_webinar` | Create a webinar |
| `zoom_update_webinar` | Update a webinar |
| `zoom_delete_webinar` | Delete a webinar |
| `zoom_list_webinar_registrants` | List webinar registrants (paginated) |
| `zoom_list_webinar_panelists` | List webinar panelists (speakers/presenters) |

### Recordings (5 tools)
| Tool | Description |
|------|-------------|
| `zoom_list_recordings` | List cloud recordings for a user (date range) |
| `zoom_get_meeting_recordings` | Get all recording files for a meeting |
| `zoom_delete_meeting_recordings` | Delete meeting recordings (trash or permanent) |
| `zoom_delete_recording_file` | Delete a single recording file |
| `zoom_recover_meeting_recordings` | Recover trashed recordings |

### Groups (2 tools)
| Tool | Description |
|------|-------------|
| `zoom_list_groups` | List all groups on the account |
| `zoom_get_group_members` | List members of a specific group |

## Rate Limits

The server automatically retries on HTTP 429 and 5xx errors with exponential backoff (up to 2 retries). Zoom rate limits vary by endpoint category:

- **General endpoints**: 10 requests/second
- **Report/metrics endpoints**: 1 request/second, 2000 requests/day
- **Billing endpoints**: 1 request/second
