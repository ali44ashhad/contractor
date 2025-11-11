# Construction Server

A robust TypeScript + Express + MongoDB server for construction project management with role-based access control.

## Features

- **User Management**: Support for 4 user types (Developer, Admin, Accounts, Contractor)
- **Project Management**: Create, assign, and manage construction projects
- **Contractor Role Support**: Assign contractor-role users to projects and teams
- **Team Management**: Create teams and assign members to projects
- **Document Management**: Upload and manage project documents with role-based permissions
- **Report Generation**: Generate various types of reports (Accounts only)
- **Role-Based Access Control**: Secure API endpoints with proper authorization

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (running locally or MongoDB Atlas connection string)

## Installation

1. Install dependencies:
```bash
npm install
```

2. Create a `.env` file:
```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:
```
PORT=3000
MONGODB_URI=mongodb://localhost:27017/construction
NODE_ENV=development
JWT_SECRET=your-secret-key-here
JWT_EXPIRES_IN=7d
JWT_ISSUER=construction-api
CORS_ORIGIN=http://localhost:3000
```

**Important**: 
- Generate a strong random secret for `JWT_SECRET` in production. You can generate one using:
  ```bash
  openssl rand -base64 32
  ```
- Set `CORS_ORIGIN` to your frontend URL to allow cookies to be sent cross-origin

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm run build
npm start
```

## Authentication

The server uses **JWT (JSON Web Tokens)** stored in **httpOnly cookies** for authentication. This provides better security than storing tokens in localStorage or sending them in headers.

### How It Works

1. **Register/Login** - The server sets an httpOnly cookie containing the JWT token
2. **Automatic Authentication** - The browser automatically sends the cookie with each request
3. **Logout** - The cookie is cleared from the browser

### Getting Authenticated

1. **Register** a new user (or have an admin create one):
```bash
POST /api/auth/register
{
  "email": "user@example.com",
  "password": "password123",
  "name": "John Doe",
  "role": "developer"
}
```

2. **Login** to set the authentication cookie:
```bash
POST /api/auth/login
{
  "email": "user@example.com",
  "password": "password123"
}
```

The server will automatically set an httpOnly cookie. No need to manually handle tokens!

### Cookie Security Features

- **httpOnly**: Prevents JavaScript access (XSS protection)
- **secure**: HTTPS only in production
- **sameSite: strict**: CSRF protection
- **Expires**: 7 days (configurable)

### Backward Compatibility

The server also supports Bearer tokens in the Authorization header for API clients that prefer that method:
```
Authorization: Bearer <your_jwt_token>
```

### Authentication Endpoints

- `POST /api/auth/register` - Register new user (sets cookie)
- `POST /api/auth/login` - Login and set authentication cookie
- `POST /api/auth/logout` - Logout and clear cookie (requires auth)
- `GET /api/auth/me` - Get current user profile (requires auth)
- `POST /api/auth/change-password` - Change password (requires auth)
- `POST /api/auth/refresh-token` - Refresh JWT token (updates cookie, requires auth)

## User Roles & Permissions

### Admin
- Create projects
- Assign projects to contractor-role users
- Add team members to projects
- Upload project requirements or other documents
- Full CRUD access to all resources

### Accounts
- Upload project requirements or other documents
- Generate reports (financial, progress, summary, custom)
- View all projects and documents

### Contractor
- Upload team details
- Create team profile
- Upload project status documents
- View assigned projects and teams

### Developer
- Basic read access (can be customized)

## API Endpoints

### Health & Info
- `GET /health` - Health check endpoint
- `GET /api` - API information and available endpoints

### Authentication (`/api/auth`)
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user profile (authenticated)
- `POST /api/auth/change-password` - Change password (authenticated)
- `POST /api/auth/refresh-token` - Refresh JWT token (authenticated)

### Users (`/api/users`)
- `GET /api/users` - Get all users (Admin only)
- `GET /api/users/:id` - Get user by ID
- `POST /api/users` - Create new user (Admin only)
- `PUT /api/users/:id` - Update user
- `DELETE /api/users/:id` - Delete user (Admin only)

### Projects (`/api/projects`)
- `GET /api/projects` - Get all projects (contractors see only their projects)
- `GET /api/projects/:id` - Get project by ID
- `POST /api/projects` - Create new project (Admin only)
- `PUT /api/projects/:id` - Update project (Admin only)
- `POST /api/projects/:id/assign` - Assign project to a contractor-role user (Admin only)
- `DELETE /api/projects/:id` - Delete project (Admin only)

### Teams (`/api/teams`)
- `GET /api/teams` - Get all teams (contractors see only their teams)
- `GET /api/teams/:id` - Get team by ID
- `POST /api/teams` - Create new team (Admin only)
- `POST /api/teams/:id/members` - Add team members (Admin only)
- `PUT /api/teams/:id` - Update team (Admin can update all, Contractors can update members)
- `DELETE /api/teams/:id` - Delete team (Admin only)

### Documents (`/api/documents`)
- `GET /api/documents` - Get all documents
- `GET /api/documents/:id` - Get document by ID
- `POST /api/documents` - Upload document
  - Admin/Accounts: requirement, other
  - Contractor: status
- `PUT /api/documents/:id` - Update document (uploader or admin)
- `DELETE /api/documents/:id` - Delete document (uploader or admin)

### Reports (`/api/reports`)
- `GET /api/reports` - Get all reports (Accounts only)
- `GET /api/reports/:id` - Get report by ID (Accounts only)
- `POST /api/reports` - Generate report (Accounts only)
  - Types: financial, progress, summary, custom
- `PUT /api/reports/:id` - Update report (Accounts only)
- `DELETE /api/reports/:id` - Delete report (Accounts only)

## Request/Response Format

### Success Response
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error message",
    "statusCode": 400
  }
}
```

## Project Structure

```
src/
  ├── config/
  │   └── database.ts          # MongoDB connection
  ├── controllers/             # Request handlers
  │   ├── userController.ts
  │   ├── projectController.ts
  │   ├── teamController.ts
  │   ├── documentController.ts
  │   └── reportController.ts
  ├── middleware/
  │   ├── auth.ts              # Authentication & authorization
  │   └── errorHandler.ts      # Global error handler
  ├── models/                  # MongoDB schemas
  │   ├── User.ts
  │   ├── Project.ts
  │   ├── Team.ts
  │   ├── Document.ts
  │   └── Report.ts
  ├── routes/                  # API routes
  │   ├── userRoutes.ts
  │   ├── projectRoutes.ts
  │   ├── teamRoutes.ts
  │   ├── documentRoutes.ts
  │   ├── reportRoutes.ts
  │   └── index.ts
  ├── utils/
  │   └── errors.ts            # Custom error classes
  └── index.ts                 # Main server file
```

## Error Handling

The server includes comprehensive error handling:
- Custom error classes (`AppError`, `ValidationError`, `NotFoundError`, etc.)
- Mongoose validation error handling
- Duplicate key error handling
- Global error handler middleware

## Code Quality

- TypeScript for type safety
- Comprehensive error handling
- Role-based access control
- Input validation
- Detailed code comments and documentation
- Scalable architecture

## Security Features

✅ **JWT Authentication** - Secure token-based authentication
✅ **Password Hashing** - Bcrypt with salt rounds (12)
✅ **Role-Based Access Control** - Fine-grained permissions
✅ **Input Validation** - Comprehensive validation on all endpoints
✅ **Error Handling** - Secure error messages without exposing internals

## Future Enhancements

- File upload handling (multer)
- Pagination for list endpoints
- Advanced filtering and sorting
- Email notifications
- Audit logging
- Rate limiting
- Password reset functionality
- Two-factor authentication

