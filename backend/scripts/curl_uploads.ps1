$json = Get-Content -Raw 'E:\ubndxanuicam_internet\backend\logs\login_response_full.json' | ConvertFrom-Json
$token = $json.token
$calendarCmd = 'curl -v -X POST http://localhost:5000/api/calendar -H "Authorization: Bearer ' + $token + '" -F "title=Auto event" -F "start=2025-12-25T09:00:00" -F "end=2025-12-25T10:00:00" -F "description=uploaded via PS curl" -F "attachment=@E:/ubndxanuicam_internet/backend/tmp/test.pdf"'
$roomCmd = 'curl -v -X POST http://localhost:5000/api/room-bookings -H "Authorization: Bearer ' + $token + '" -F "title=Auto Room Booking" -F "start_time=2025-12-26T09:00:00" -F "end_time=2025-12-26T10:00:00" -F "department_id=1" -F "attendees_count=10" -F "has_led=true" -F "attachment=@E:/ubndxanuicam_internet/backend/tmp/test.pdf"'

Write-Output "Running calendar upload..."
Invoke-Expression $calendarCmd
Write-Output "Running room booking upload..."
Invoke-Expression $roomCmd
