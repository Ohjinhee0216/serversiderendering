var express = require('express');
var router = express.Router();
var ctrlsvg = require('../controllers/make_svg.js');

router.get('/:lc/:da/:o1/:o2', ctrlsvg.mainView);

module.exports = router;