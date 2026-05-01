# API

All endpoints require `Authorization: Bearer <token>`. The token is set at compile time via the `EPD_TOKEN` build flag and validated on every request. Missing or wrong → `401 Unauthorized`.

See [wire-format.md](wire-format.md) for the framebuffer byte layout, and [refresh-contract.md](refresh-contract.md) for what happens after a push is accepted.

## `POST /fb`

Push a new framebuffer.

| Header | Value |
|---|---|
| `Content-Type` | `application/octet-stream` |
| `Content-Length` | `163200` (rejected otherwise) |

### Responses

| Code | Meaning |
|---|---|
| `200 OK` | Body accepted. JSON body indicates whether the frame is being written immediately or has been queued behind a refresh/cooldown (`{"status":"accepted"}` vs `{"status":"queued"}`). |
| `400 Bad Request` | Body length wrong or short. |
| `401 Unauthorized` | Missing or wrong bearer token. |
| `413 Payload Too Large` | Body exceeded `Content-Length`. |
| `500 Internal Server Error` | Buffer write failed. |
| `503 Service Unavailable` | Another upload is currently in flight, or the panel is mid-display-write. Retry shortly. |

The client always sees a fast response. There is no synchronous "wait for refresh to finish" path. To know when the panel actually updates, poll `GET /status`.

### Example

```sh
curl -X POST \
  -H "Authorization: Bearer $EPD_TOKEN" \
  -H "Content-Type: application/octet-stream" \
  --data-binary @frame.bin \
  http://kitchen-display.local/fb
```

## `GET /status`

Returns current state as JSON.

```json
{
  "busy": false,
  "cooldown_remaining_s": 142,
  "last_refresh_uptime_s": 86230,
  "last_refresh_timed_out": false,
  "uptime_s": 86412,
  "free_heap": 198432,
  "rssi": -54,
  "pending_frame": true
}
```

| Field | Type | Meaning |
|---|---|---|
| `busy` | bool | `true` while the panel is actively refreshing (BUSY pin asserted). |
| `cooldown_remaining_s` | int | Seconds until the next push will trigger an immediate refresh. `0` when idle. |
| `last_refresh_uptime_s` | int | `uptime_s` at which the most recent refresh **completed**. `0` if no refresh has happened since boot. (No NTP on device, so this is monotonic uptime, not wall-clock.) |
| `last_refresh_timed_out` | bool | `true` if the most recent refresh was abandoned because the panel did not release BUSY in time. Indicates a likely cable or panel issue. |
| `uptime_s` | int | Seconds since boot. |
| `free_heap` | int | Bytes of free heap. |
| `rssi` | int | Current WiFi signal strength in dBm. |
| `pending_frame` | bool | `true` if a buffered frame is waiting for the cooldown to end. |
