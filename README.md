# Zoom MCP Server

MCP server for the Zoom API. Manage users, meetings, webinars, and recordings through 24 tools.

## Setup

Install dependencies:

```sh
npm install
```

Build:

```sh
npm run build
```

## Authentication

Choose one:

**Server-to-Server OAuth (recommended)**

Create a Server-to-Server OAuth app in the [Zoom Marketplace](https://marketplace.zoom.us/) and set:

```sh
export ZOOM_ACCOUNT_ID=your_account_id
export ZOOM_CLIENT_ID=your_client_id
export ZOOM_CLIENT_SECRET=your_client_secret
```

**Static bearer token**

```sh
export ZOOM_API_TOKEN=your_token
```

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

### Users
| Tool | Description |
|------|-------------|
| `zoom_list_users` | List users on the account (paginated) |
| `zoom_get_user` | Get user details by ID or email |
| `zoom_create_user` | Create a new user |
| `zoom_update_user` | Update user profile |
| `zoom_delete_user` | Delete or disassociate a user |

### Meetings
| Tool | Description |
|------|-------------|
| `zoom_list_meetings` | List meetings for a user (paginated) |
| `zoom_get_meeting` | Get meeting details |
| `zoom_create_meeting` | Create a meeting |
| `zoom_update_meeting` | Update a meeting |
| `zoom_delete_meeting` | Delete a meeting |
| `zoom_end_meeting` | End a live meeting |
| `zoom_list_meeting_registrants` | List meeting registrants (paginated) |
| `zoom_get_past_meeting` | Get past meeting details |
| `zoom_get_past_meeting_participants` | List past meeting participants |

### Webinars
| Tool | Description |
|------|-------------|
| `zoom_list_webinars` | List webinars for a user (paginated) |
| `zoom_get_webinar` | Get webinar details |
| `zoom_create_webinar` | Create a webinar |
| `zoom_update_webinar` | Update a webinar |
| `zoom_delete_webinar` | Delete a webinar |
| `zoom_list_webinar_registrants` | List webinar registrants (paginated) |

### Recordings
| Tool | Description |
|------|-------------|
| `zoom_list_recordings` | List cloud recordings for a user (date range) |
| `zoom_get_meeting_recordings` | Get all recording files for a meeting |
| `zoom_delete_meeting_recordings` | Delete meeting recordings (trash or permanent) |
| `zoom_delete_recording_file` | Delete a single recording file |
| `zoom_recover_meeting_recordings` | Recover trashed recordings |

## Rate Limits

The server automatically retries on HTTP 429 and 5xx errors with exponential backoff (up to 2 retries). Zoom rate limits vary by endpoint category:

- **General endpoints**: 10 requests/second
- **Report/metrics endpoints**: 1 request/second, 2000 requests/day
- **Billing endpoints**: 1 request/second
