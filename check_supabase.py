import urllib.request
import json

url = "https://wywgkikkjgbnlljkkmnz.supabase.co/rest/v1/standard_options?select=*"
key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind5d2draWtramdibmxsamtrbW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQzNjcxMzgsImV4cCI6MjA5OTk0MzEzOH0.gSftxhQjFmWUQzikx-Q5UsdgNKSZISZqJvUGeLBOCqU"

req = urllib.request.Request(url, headers={
    'apikey': key,
    'Authorization': f'Bearer {key}'
})

try:
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        data = response.read()
        print("Response:", data.decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
