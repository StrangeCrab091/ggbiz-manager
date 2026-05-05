const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automation.controller');

router.get('/', automationController.getRules);
router.post('/', automationController.createRule);
router.put('/:id', automationController.updateRule);
router.delete('/:id', automationController.deleteRule);

module.exports = router;
