$logPath = 'E:\ubndxanuicam_internet\backend\logs\login_response_full.json'
$login = Get-Content -Raw $logPath | ConvertFrom-Json
$token = $login.token

# Create event
$eventResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/calendar' -Method Post -Headers @{ Authorization = "Bearer $token" } -Form @{ title='Auto test event'; start='2025-12-25T09:00:00'; end='2025-12-25T10:00:00'; description='uploaded via PS'; attachment = Get-Item 'E:\ubndxanuicam_internet\backend\tmp\test.pdf' } -UseBasicParsing -TimeoutSec 30
$eventResp | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 'E:\ubndxanuicam_internet\backend\logs\create_event_response.json'

# Create room booking
$roomResp = Invoke-RestMethod -Uri 'http://localhost:5000/api/room-bookings' -Method Post -Headers @{ Authorization = "Bearer $token" } -Form @{ title='Auto Room Booking'; start_time='2025-12-26T09:00:00'; end_time='2025-12-26T10:00:00'; department_id='1'; attendees_count='10'; has_led='true'; attachment = Get-Item 'E:\ubndxanuicam_internet\backend\tmp\test.pdf' } -UseBasicParsing -TimeoutSec 30
$roomResp | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 'E:\ubndxanuicam_internet\backend\logs\create_room_response.json'

Write-Output 'WROTE create_event_response.json and create_room_response.json'
