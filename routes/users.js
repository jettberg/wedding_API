const express  = require('express');
const crypto   = require('crypto');
const router   = express.Router();
const { Timeline, Session } = require('../models');
const { requireAuth, requireRole } = require('../middleware/auth');

// ════════════════════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /users/login
// Body: { email: string, timelineId: string }
// Checks if the email has access to the given timeline.
// Returns a session token on success.
router.post('/login', async (req, res) => {
  try {
    const email      = (req.body.email || '').trim().toLowerCase();
    const timelineId = req.body.timelineId;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Please provide a valid email address.' });
    }
    if (!timelineId) {
      return res.status(400).json({ error: 'timelineId is required.' });
    }

    const timeline = await Timeline.findById(timelineId).select('permissions ownerEmail');
    if (!timeline) {
      return res.status(404).json({ error: 'Timeline not found.' });
    }

    const entry = timeline.permissions.find(p => p.email === email);
    if (!entry) {
      return res.status(403).json({
        error: 'You do not have access to this timeline. Please request access from the owner.',
      });
    }

    // Create or refresh session token
    const token = crypto.randomBytes(32).toString('hex');
    await Session.findOneAndUpdate(
      { email },
      { token, createdAt: new Date() },
      { upsert: true, new: true }
    );

    res.json({ token, role: entry.role, email });
  } catch (err) {
    console.error('POST /login error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /users/logout
// Deletes the session for the current user.
router.post('/logout', requireAuth, async (req, res) => {
  try {
    await Session.deleteOne({ email: req.userEmail });
    res.json({ message: 'Logged out.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /users/me
// Returns the current user's email and their role on a given timeline.
// Query param: ?timelineId=xxx
router.get('/me', requireAuth, async (req, res) => {
  try {
    const timelineId = req.query.timelineId;
    let role = null;
    if (timelineId) {
      const timeline = await Timeline.findById(timelineId).select('permissions');
      if (timeline) {
        const entry = timeline.permissions.find(p => p.email === req.userEmail);
        role = entry ? entry.role : null;
      }
    }
    res.json({ email: req.userEmail, role });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// TIMELINE ROUTES
// ════════════════════════════════════════════════════════════════════════════

// POST /users/timeline
// Create a new timeline. The authenticated user becomes the owner.
// Body: { weddingName?, people?, events? }
router.post('/timeline', requireAuth, async (req, res) => {
  try {
    const { weddingName, people, events } = req.body;
    const timeline = new Timeline({
      weddingName:  weddingName || 'Wedding Timeline',
      ownerEmail:   req.userEmail,
      permissions:  [{ email: req.userEmail, role: 'owner' }],
      people:       people || [],
      events:       events || [],
    });
    await timeline.save();
    res.status(201).json({ timelineId: timeline._id, timeline });
  } catch (err) {
    console.error('POST /timeline error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /users/timeline/:timelineId
// Load a timeline. Any permitted user (owner/editor/viewer) can read.
router.get('/timeline/:timelineId', requireAuth, async (req, res) => {
  try {
    const timeline = await Timeline.findById(req.params.timelineId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });

    const entry = timeline.permissions.find(p => p.email === req.userEmail);
    if (!entry) return res.status(403).json({ error: 'Access denied.' });

    res.json({ timeline, role: entry.role });
  } catch (err) {
    console.error('GET /timeline error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /users/timeline/:timelineId
// Save (overwrite) the full timeline. Requires editor or owner.
// Body: { weddingName?, people?, events? }
router.put('/timeline/:timelineId', requireAuth, requireRole('editor'), async (req, res) => {
  try {
    const { weddingName, people, events } = req.body;
    const update = { lastUpdated: new Date() };
    if (weddingName !== undefined) update.weddingName = weddingName;
    if (people      !== undefined) update.people      = people;
    if (events      !== undefined) update.events      = events;

    const timeline = await Timeline.findByIdAndUpdate(
      req.params.timelineId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });

    res.json({ timeline });
  } catch (err) {
    console.error('PUT /timeline error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /users/timeline/:timelineId
// Permanently delete a timeline. Owner only.
router.delete('/timeline/:timelineId', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    await Timeline.findByIdAndDelete(req.params.timelineId);
    res.json({ message: 'Timeline deleted.' });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});


// ════════════════════════════════════════════════════════════════════════════
// PERMISSIONS ROUTES
// ════════════════════════════════════════════════════════════════════════════

// GET /users/timeline/:timelineId/permissions
// List all permissions on a timeline. Owner only.
router.get('/timeline/:timelineId/permissions', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const timeline = await Timeline.findById(req.params.timelineId).select('permissions ownerEmail');
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });
    res.json({ permissions: timeline.permissions });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /users/timeline/:timelineId/permissions
// Grant access to a new user. Owner only.
// Body: { email: string, role: 'editor' | 'viewer' }
router.post('/timeline/:timelineId/permissions', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const email = (req.body.email || '').trim().toLowerCase();
    const role  = req.body.role;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email required.' });
    }
    if (!['editor', 'viewer'].includes(role)) {
      return res.status(400).json({ error: 'Role must be "editor" or "viewer".' });
    }

    const timeline = await Timeline.findById(req.params.timelineId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });

    const existing = timeline.permissions.find(p => p.email === email);
    if (existing) {
      return res.status(409).json({ error: 'This email already has access.' });
    }

    timeline.permissions.push({ email, role });
    await timeline.save();
    res.status(201).json({ permissions: timeline.permissions });
  } catch (err) {
    console.error('POST /permissions error:', err);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PATCH /users/timeline/:timelineId/permissions/:email
// Change the role of an existing permitted user. Owner only.
// Body: { role: 'editor' | 'viewer' }
router.patch('/timeline/:timelineId/permissions/:email', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase();
    const newRole     = req.body.role;

    if (!['editor', 'viewer'].includes(newRole)) {
      return res.status(400).json({ error: 'Role must be "editor" or "viewer".' });
    }

    const timeline = await Timeline.findById(req.params.timelineId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });

    const entry = timeline.permissions.find(p => p.email === targetEmail);
    if (!entry) return res.status(404).json({ error: 'User not found in permissions list.' });
    if (entry.role === 'owner') return res.status(400).json({ error: 'Cannot change the owner role.' });

    entry.role = newRole;
    await timeline.save();
    res.json({ permissions: timeline.permissions });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /users/timeline/:timelineId/permissions/:email
// Remove a user's access. Owner only.
router.delete('/timeline/:timelineId/permissions/:email', requireAuth, requireRole('owner'), async (req, res) => {
  try {
    const targetEmail = req.params.email.toLowerCase();

    const timeline = await Timeline.findById(req.params.timelineId);
    if (!timeline) return res.status(404).json({ error: 'Timeline not found.' });

    const entry = timeline.permissions.find(p => p.email === targetEmail);
    if (!entry) return res.status(404).json({ error: 'User not found.' });
    if (entry.role === 'owner') return res.status(400).json({ error: 'Cannot remove the owner.' });

    timeline.permissions = timeline.permissions.filter(p => p.email !== targetEmail);
    await timeline.save();
    res.json({ permissions: timeline.permissions });
  } catch (err) {
    res.status(500).json({ error: 'Server error.' });
  }
});

module.exports = router;