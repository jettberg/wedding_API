const { Session, Timeline } = require('../models'); // <-- was './models'

async function requireAuth(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ')
      ? authHeader.slice(7).trim()
      : null;

    if (!token) {
      return res.status(401).json({ error: 'No session token provided.' });
    }

    const session = await Session.findOne({ token });
    if (!session) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }

    req.userEmail = session.email;

    const timelineId = req.params.timelineId || req.body?.timelineId;
    if (timelineId) {
      const timeline = await Timeline.findById(timelineId).select('permissions ownerEmail');
      if (timeline) {
        const entry = timeline.permissions.find(p => p.email === session.email);
        req.userRole = entry ? entry.role : null;
        req.timeline = timeline;
      }
    }

    next();
  } catch (err) {
    console.error('requireAuth error:', err);
    res.status(500).json({ error: 'Server error during authentication.' });
  }
}

const ROLE_RANK = { owner: 3, editor: 2, viewer: 1 };

function requireRole(minimumRole) {
  return (req, res, next) => {
    const rank = ROLE_RANK[req.userRole] || 0;
    if (rank < (ROLE_RANK[minimumRole] || 0)) {
      return res.status(403).json({
        error: `Access denied. Requires ${minimumRole} role or higher.`,
      });
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };