import requests
import json

base_url = "http://localhost:5000/api"
email = "testmobile@temple.com"
password = "password123"

# Login
try:
    print(f"Logging in as {email}...")
    resp = requests.post(f"{base_url}/users/login", json={"email": email, "password": password})
    resp.raise_for_status()
    data = resp.json()
    token = data['data']['token']
    print("Login successful. Token obtained.")
except Exception as e:
    print(f"Login failed: {e}")
    # If login fails (maybe user doesn't exist if registration failed previously?), try register
    try:
        print("Trying registration...")
        resp = requests.post(f"{base_url}/users/register", json={"email": email, "password": password, "full_name": "Test Mobile"})
        resp.raise_for_status()
        data = resp.json()
        token = data['data']['token']
        print("Registration successful. Token obtained.")
    except Exception as reg_e:
        print(f"Registration failed: {reg_e}")
        exit(1)

headers = {"Authorization": f"Bearer {token}"}

# Test /mobile/me/events
print("\nTesting GET /mobile/me/events...")
try:
    resp = requests.get(f"{base_url}/mobile/me/events", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {json.dumps(resp.json(), indent=2)}")
except Exception as e:
    print(f"Request failed: {e}")

# Test /mobile/me/communities (just to be sure)
print("\nTesting GET /mobile/me/communities...")
try:
    resp = requests.get(f"{base_url}/mobile/me/communities", headers=headers)
    print(f"Status: {resp.status_code}")
    print(f"Response: {json.dumps(resp.json(), indent=2)}")
except Exception as e:
    print(f"Request failed: {e}")

