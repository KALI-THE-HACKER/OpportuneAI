# API Specification

This document details OpportuneAI's API endpoints, request/response models, authentication rules, validation, and error structures.

---

## 1. Global Core Specifications

### Base URL
- Development: `http://localhost:8000`
- Production: `https://opportuneai.luckylinux.dev` (Configurable via `VITE_API_URL` env variable in frontend)

### Content Type
All requests and responses use `application/json` format (except multipart file uploads).

### Authentication Protocol
FastAPI verifies incoming JWTs using public signature keys from Auth0 domains.
- Headers format: `Authorization: Bearer <token>`
- Mock Authentication: Sending a token prefixed with `mock-` (e.g. `mock-auth0|user1;user@example.com;UserName;avatar`) bypasses Auth0 checks for local testing.

---

## 2. Authentication & Profile Endpoints

### 2.1 Authenticate / Login
- **Endpoint**: `POST /api/auth/login`
- **Authentication Required**: No
- **Request Body (`LoginInputSchema`)**:
  ```json
  {
    "email": "user@example.com",
    "password": "SecurePassword123"
  }
  ```
- **Response (`SessionSchema`)**:
  ```json
  {
    "token": "eyJhbGciOi...",
    "user": {
      "id": "auth0|64f2b...",
      "name": "Jane Doe",
      "email": "user@example.com",
      "title": "Software Engineer",
      "location": "Bengaluru, India",
      "avatarUrl": "https://lh3.googleusercontent.com/...",
      "bio": "Product developer",
      "yearsOfExperience": 3,
      "skills": ["Python", "SQL", "FastAPI"],
      "preferredRoles": ["Backend Engineer"],
      "preferredLocations": ["Bengaluru", "Remote"],
      "workModes": ["hybrid", "remote"],
      "minSalary": 80000,
      "emailVerified": true
    },
    "expiresAt": 1785123456000,
    "message": "Success"
  }
  ```

### 2.2 Register / Sign Up
- **Endpoint**: `POST /api/auth/register`
- **Authentication Required**: No
- **Request Body (`RegisterInputSchema`)**:
  ```json
  {
    "name": "John Doe",
    "email": "newuser@example.com",
    "password": "Password987!"
  }
  ```
- **Response (`SessionSchema`)**: Returns the same structure as `/api/auth/login`. In real Auth0 mode, if email is unverified, `token` may return `null` with a verification message.

### 2.3 Get Current User Profile
- **Endpoint**: `GET /api/auth/me`
- **Authentication Required**: Yes
- **Response (`UserProfileSchema`)**: Returns user profile metrics matching user preferences.

### 2.4 Update Current User Profile
- **Endpoint**: `PUT /api/users/me`
- **Authentication Required**: Yes
- **Request Body (`UserProfileUpdateSchema`)**: (All fields are optional)
  ```json
  {
    "name": "Jane Updated",
    "title": "Senior Backend Engineer",
    "location": "Delhi, India",
    "avatarUrl": "https://new-url.com/avatar.png",
    "bio": "Updated biography text",
    "yearsOfExperience": 5,
    "skills": ["Python", "FastAPI", "PostgreSQL", "Docker"],
    "preferredRoles": ["Senior Backend Engineer", "Lead Developer"],
    "preferredLocations": ["Delhi", "Remote"],
    "workModes": ["remote"],
    "minSalary": 120000
  }
  ```
- **Response (`UserProfileSchema`)**: Returns the complete updated user profile.

---

## 3. Job Endpoints (Expected Backend Integrations)

*The following endpoints are currently mock-simulated in the frontend app shell and must be fully implemented in FastAPI route controllers:*

### 3.1 Search & List Jobs
- **Endpoint**: `GET /api/jobs`
- **Authentication Required**: Yes
- **Query Parameters**:
  - `q` (string, optional): Title, company, or skills keyword search.
  - `workMode` (array, optional): Filter (e.g. `remote`, `hybrid`, `onsite`).
  - `type` (array, optional): Filter (e.g. `full-time`, `part-time`, `internship`).
  - `experienceLevel` (array, optional): Filter.
  - `minSalary` (integer, optional): Minimum budget.
  - `sort` (string, optional): Sort sorting key (`relevance`, `recent`, `salary-high`, `salary-low`).
  - `page` (integer, default `1`): Pagination.
  - `pageSize` (integer, default `10`): Items per page.
- **Response**:
  ```json
  {
    "items": [
      {
        "id": "job-101",
        "title": "Backend Developer",
        "company": "Tech Corp",
        "skills": ["Python", "SQL"],
        "location": "Remote",
        "workMode": "remote",
        "type": "full-time",
        "salaryMin": 90000,
        "salaryMax": 120000,
        "experienceLevel": "mid",
        "postedAt": "2026-07-25T10:00:00Z",
        "matchScore": 85,
        "saved": false,
        "applied": false
      }
    ],
    "total": 1,
    "page": 1,
    "pageSize": 10
  }
  ```

### 3.2 Get Job Details
- **Endpoint**: `GET /api/jobs/{id}`
- **Authentication Required**: Yes
- **Response**: Returns a detailed job object, including complete description markdown and match scoring metrics.

### 3.3 Get AI Recommendations
- **Endpoint**: `GET /api/recommendations`
- **Authentication Required**: Yes
- **Query Parameters**:
  - `limit` (integer, default `6`): Maximum matches to pull.
- **Response**: Array of jobs sorted by match scores matching user skills and preferences.

### 3.4 List Saved Jobs
- **Endpoint**: `GET /api/saved`
- **Authentication Required**: Yes
- **Response**: Array of job objects flagged as saved by the user.

### 3.5 Toggle Save Job
- **Endpoint**: `POST /api/saved/{id}`
- **Authentication Required**: Yes
- **Response**:
  ```json
  {
    "saved": true
  }
  ```

---

## 4. Resume Endpoints

### 4.1 Upload Resume
- **Endpoint**: `POST /api/resume/upload`
- **Authentication Required**: Yes
- **Request Format**: `multipart/form-data`
- **Form Fields**:
  - `file`: PDF binary content.
- **Constraints**: PDF only, maximum 5 MB. The PDF is stored privately in Cloudflare R2 and parsed in memory. The API never returns a public object URL.
- **Response**: `202 Accepted` with the resume metadata and a `processing`, `processed`, or `failed` status. AI parsing runs asynchronously and merges extracted skills into the user profile.

### 4.2 Get Resume
- **Endpoint**: `GET /api/resume`
- **Authentication Required**: Yes
- **Response**: Resume metadata and extracted skills, experience level, total years, and confidence. Returns `404` when no resume has been uploaded.

### 4.3 Delete Resume
- **Endpoint**: `DELETE /api/resume`
- **Authentication Required**: Yes
- **Response**: `204 No Content`. Clears the stored extracted text and resume metadata; previously merged profile skills remain user profile data.

---

## 5. Error & Validation Schema

### Pydantic Validation Error (HTTP 422)
Occurs when request payloads fail validation checks.
- **Response Format**:
  ```json
  {
    "detail": [
      {
        "loc": ["body", "email"],
        "msg": "value is not a valid email address",
        "type": "value_error.email"
      }
    ]
  }
  ```

### Auth0 Service Error (HTTP 500)
Returned when connection to Auth0 servers encounters failures.
- **Response Format**:
  ```json
  {
    "detail": "Auth0 service error: connection timeout"
  }
  ```

### Unauthorized Credentials (HTTP 401)
Triggered when the request lacks a valid token or uses an expired token.
- **Response Format**:
  ```json
  {
    "detail": "Could not validate credentials"
  }
  ```

---

## 6. Events Endpoints

### 6.1 Record a User–Job Interaction Event
- **Endpoint**: `POST /api/v1/events/jobs`
- **Authentication Required**: Yes (Bearer JWT)
- **Request Body (`CreateUserJobEventRequest`)**:
  ```json
  {
    "job_id": 42,
    "event_type": "click",
    "source": "feed",
    "position": 3,
    "session_id": "sess-abc123",
    "metadata": {}
  }
  ```
- **Fields**:
  | Field | Type | Required | Notes |
  |---|---|---|---|
  | `job_id` | int | ✅ | Must reference an existing `processed_jobs.id` |
  | `event_type` | enum | ✅ | `impression` / `click` / `view` / `save` / `unsave` / `apply` / `dismiss` / `not_interested` |
  | `source` | enum | ✅ | `feed` / `search` / `job_detail` / `recommendation` / `notification` / `other` |
  | `position` | int ≥ 0 | ❌ | Card position in the list |
  | `session_id` | string | ❌ | Opaque frontend session identifier |
  | `metadata` | object | ❌ | Event-specific JSONB payload. `view` events may include `duration_seconds` (≥ 0) |
- **Response** (`201 Created`):
  ```json
  {
    "id": 1001,
    "event_type": "click",
    "created_at": "2026-08-22T18:00:00"
  }
  ```
- **Notes**:
  - `user_id` is derived from the JWT — cannot be supplied by the client.
  - The table is append-only; events are never modified.
  - Designed for high-frequency writes: no LLM calls, no feed regeneration.
- **Errors**:
  - `401` — missing or invalid token
  - `404` — `job_id` does not exist in `processed_jobs`
  - `422` — invalid `event_type`, `source`, negative `position`, or invalid metadata
