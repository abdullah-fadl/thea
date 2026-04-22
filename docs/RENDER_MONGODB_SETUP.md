# MongoDB Setup for Render Deployment

## Troubleshooting "bad auth : authentication failed" Error

If you see this error after deployment, follow these steps:

### 1. Verify MongoDB Atlas User Credentials

1. Go to [MongoDB Atlas Dashboard](https://cloud.mongodb.com)
2. Navigate to **Database Access** (left sidebar)
3. Find your database user or create a new one
4. **Important**: Make sure the user has:
   - Password Authentication enabled
   - Proper database user privileges (at least `readWrite` on `hospital_ops` database)

### 2. Verify MONGO_URL Format on Render

1. Go to your Render service dashboard
2. Click on **Environment** tab
3. Find `MONGO_URL` variable
4. Format should be:
   ```
   mongodb+srv://USERNAME:PASSWORD@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority
   ```

5. **Common Issues**:
   - ❌ Wrong username or password
   - ❌ Special characters in password not URL-encoded
   - ❌ Extra spaces before/after the URL
   - ❌ Missing database name in the URL

### 3. URL-encode Special Characters in Password

If your password contains special characters, you must URL-encode them:

| Character | Encoded |
|-----------|---------|
| `@` | `%40` |
| `#` | `%23` |
| `$` | `%24` |
| `%` | `%25` |
| `&` | `%26` |
| `+` | `%2B` |
| `=` | `%3D` |
| `?` | `%3F` |
| `/` | `%2F` |
| ` ` (space) | `%20` |

**Example**:
- Password: `myP@ss#123`
- Encoded: `myP%40ss%23123`
- Connection string: `mongodb+srv://user:myP%40ss%23123@cluster.mongodb.net/db`

### 4. Check Network Access in MongoDB Atlas

1. Go to MongoDB Atlas Dashboard
2. Navigate to **Network Access** (left sidebar)
3. Click **Add IP Address**
4. For Render, you can either:
   - Add `0.0.0.0/0` (allows all IPs - use for testing)
   - Add Render's specific IP ranges (more secure)
   - Check Render's documentation for their IP ranges

### 5. Test Connection String Locally

Before deploying, test the connection string locally:

```bash
# Test with MongoDB Compass or mongo shell
mongodb+srv://USERNAME:PASSWORD@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops
```

Or use Node.js:

```javascript
const { MongoClient } = require('mongodb');
const uri = 'mongodb+srv://USERNAME:PASSWORD@hospitalos-cluster.hqi1xpu.mongodb.net/hospital_ops?retryWrites=true&w=majority';

async function test() {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    console.log('✅ Connection successful!');
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
  } finally {
    await client.close();
  }
}

test();
```

### 6. Reset MongoDB User Password (if needed)

If you're unsure about the password:

1. Go to MongoDB Atlas → Database Access
2. Click **Edit** on your database user
3. Click **Edit Password**
4. Generate a new password (or create your own)
5. **Copy the password immediately** (you won't see it again)
6. Update `MONGO_URL` on Render with the new password
7. Redeploy your service

### 7. Common Solutions

#### Solution 1: Create a New Database User

1. MongoDB Atlas → Database Access → **Add New Database User**
2. Choose **Password** authentication
3. Set username (e.g., `render-user`)
4. Generate or set password
5. Set user privileges: **Read and write to any database**
6. Click **Add User**
7. Use this new user in your `MONGO_URL` on Render

#### Solution 2: Verify Cluster Connection String

1. MongoDB Atlas → Clusters → Click **Connect**
2. Choose **Connect your application**
3. Copy the connection string template:
   ```
   mongodb+srv://<username>:<password>@hospitalos-cluster.hqi1xpu.mongodb.net/?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your actual credentials
5. Add database name: `mongodb+srv://...mongodb.net/hospital_ops?...`
6. Use this exact string in Render's `MONGO_URL`

### 8. After Fixing

1. Update `MONGO_URL` on Render
2. Redeploy your service (or it will auto-redeploy if auto-deploy is enabled)
3. Check logs to verify connection is successful
4. Test login functionality

### Quick Checklist

- [ ] MongoDB Atlas user exists and password is correct
- [ ] `MONGO_URL` on Render has correct format
- [ ] Password special characters are URL-encoded (if any)
- [ ] Network Access in Atlas allows Render's IP (or 0.0.0.0/0)
- [ ] Database name `hospital_ops` is correct
- [ ] Connection string tested locally (optional but recommended)

### Getting Help

If issues persist:
1. Check Render service logs for detailed error messages
2. Verify connection string format matches MongoDB Atlas requirements
3. Try creating a new database user with a simple password (no special chars)
4. Contact MongoDB Atlas support if authentication continues to fail
