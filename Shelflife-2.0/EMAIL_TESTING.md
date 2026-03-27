# ShelfLife - Email & Expiry Testing Guide

## 📧 **Email Configuration (REQUIRED)**

To enable automatic email sending, update your `.env` file:

```env
MAIL_USERNAME=your_gmail@gmail.com
MAIL_PASSWORD=xxxx xxxx xxxx xxxx    (Gmail App Password - 16 chars)
MAIL_DEFAULT_SENDER=your_gmail@gmail.com
```

Set an admin-only secret so you can trigger the expiry workflow for every user:

```env
ADMIN_SECRET=a_long_random_string
```

When sending the global trigger, include that value as the `X-ShelfLife-Admin-Secret` header (see below).

### **Get Gmail App Password:**
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Click "App passwords"
4. Select "Mail" and "Windows Computer"
5. Copy the 16-character password

---

## ⏰ **Email Sending Schedule**

- **Scheduled Check:** Every 1 day automatically
- **Manual Test:** Use the endpoints below

---

## 🌐 **API Endpoints for Testing**

### **1. Manually Trigger Email for Specific User**

```bash
curl -X POST http://localhost:5000/alerts/notifications/send-email \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Response:**
```json
{
  "message": "Expiry emails processed",
  "sent": [
    "🚨 Milk expires TODAY",
    "⚠️ Eggs expire in 2 days - Use it soon!"
  ]
}
```

### **2. Get All Notifications for User**

```bash
curl -X GET http://localhost:5000/alerts/notifications \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

### **3. Trigger expiry emails for every user (admin only)**

```bash
curl -X POST http://localhost:5000/alerts/notifications/send-email/all \
  -H "X-ShelfLife-Admin-Secret: a_long_random_string"
```

**Response:**

```json
{
  "message": "Expiry emails processed for all users",
  "summary": [
    {
      "user_id": 1,
      "sent": ["Milk expires TODAY"],
      "attempted": 1,
      "reason": "sent"
    },
    ...
  ]
}
```

Each row in `summary` shows how many messages were attempted for that user and why delivery was skipped. Keep the secret private.

---

## 📊 **When Emails Are Sent**

| Days Left | Email Sent? | Status |
|-----------|------------|--------|
| **< 0** | ✅ Yes | `expired` 🚨 |
| **0** | ✅ Yes | `expiring_critical` ⏰ |
| **1** | ✅ Yes | `expiring_critical` ⏰ |
| **2-3** | ✅ Yes | `expiring_soon` ⚠️ |
| **> 3** | ❌ No | `safe` |

---

## 🧪 **Testing Steps**

### **Step 1: Create Test Item**
1. Go to Dashboard → Add Item
2. Add an item with expiry date **TODAY**
3. Example: "Milk" → Expires today

### **Step 2: Wait for Scheduler (or Manually Trigger)**
- **Option A: Wait 1 day** for automatic check
- **Option B: Get JWT token and call the API endpoint** to manually trigger

### **Step 3: Check Email**
- Check your inbox for ShelfLife email
- Subject will be based on days remaining:
  - 🚨 **Item Expired** (0+ days past)
  - ⏰ **Expires Today/Tomorrow** (0-1 day)
  - ⚠️ **Use Soon 2-3 Days** (2-3 days)

### **Step 4: Check Notifications Dashboard**
- Go to Notifications page
- You'll see the same alerts there

---

## 🔧 **Troubleshooting**

### **Emails Not Sending?**

1. **Check `.env` Credentials**
   ```
   MAIL_USERNAME=your_gmail@gmail.com
   MAIL_PASSWORD=xxxx xxxx xxxx xxxx
   ```

2. **Check Flask Console for Errors**
   ```
   ✅ Email sent to user@gmail.com: ShelfLife Alert
   ❌ Email sending failed: [Error message]
   ```

3. **Verify Gmail Less Secure Apps**
   - Go to https://myaccount.google.com/apppasswords
   - Make sure you generated a real **App Password**, not your regular password

4. **Test with Curl**
   ```bash
   curl -X POST http://localhost:5000/alerts/notifications/send-email \
     -H "Authorization: Bearer YOUR_TOKEN"
   ```

### **Items Not Showing as Expiring?**

- Check Dashboard table - items should show **"Days Left"**
- Expiry date must be within 0-3 days to trigger emails
- Database must have items linked to your account

---

## 📝 **Example Email Content**

```
ShelfLife Expiry Alert
=====================

⏰ Milk expires TODAY

Please check your pantry and use items expiring soon.

Don't waste food - manage your inventory with ShelfLife!
```

---

## 🎯 **Quick Checklist**

- [ ] Gmail credentials added to `.env`
- [ ] Server restarted after updating `.env`
- [ ] Created a test item with today's date
- [ ] Checked Flask console for "✅ Email sent" message
- [ ] Checked email inbox for ShelfLife alert
- [ ] Verified notifications show on dashboard

---

**Need Help?** Check the Flask server console output for detailed error messages!
