
/**
 * Module dependencies.
 */

var cheerio = require('cheerio');
var thunkify = require('thunkify-wrap');
var request = thunkify(require('request'));
var write = require('./debug').write;
var req = require('request');
var fs = require('fs');

/**
 * Expose `Slack`.
 */

module.exports = Slack;

/**
 * Static variables
 */

var loginFormPath = '/?no_sso=1';
var emojiUploadFormPath = '/admin/emoji';
var emojiUploadImagePath = '/customize/emoji';

/**
 * Initialize a new `Slack`.
 */

function Slack(opts, debug) {
  if (!(this instanceof Slack)) return new Slack(opts);
  this.opts = opts;
  this.debug = debug;

  /**
   * Do everything.
   */

  this.import = function *() {
    try {
      console.log('Starting delete');
      yield this.tokens();
      console.log('Got tokens');
      yield this.login();
      console.log('Logged in');
      yield this.emoji();
    } catch (e) {
      console.log('Uh oh! ' + e);
      throw e;
    }
    console.log('Getting emoji page');
    for (var i = 0; i < Object.keys(this.opts.emojis).length; i++) {
      var e = this.opts.emojis[i];
      var uploadRes = yield this.deleted(e.name);
    }
    console.log('Deleted emojis');
    return 'Success';
  };

  /**
   * Get login page (aka credentials).
   */

  this.tokens = function *() {
    var opts = this.opts;
    opts.jar = opts.jar || { _jar: { store: { idx: {} } } };
    var load = {
      url: opts.url + loginFormPath,
      jar: opts.jar,
      method: 'GET'
    };
    var res = yield request(load);
    var $ = cheerio.load(res[0].body);
    if (this.debug) write($('title').text(), $.html());
    opts.formData = {
      signin: $('#signin_form input[name="signin"]').attr('value'),
      redir: $('#signin_form input[name="redir"]').attr('value'),
      crumb: $('#signin_form input[name="crumb"]').attr('value'),
	  remove: $('#signin_form input[name="remove"]').attr('value'),
      remember: 'on',
      email: opts.email,
      password: opts.password
    };
    if (!opts.formData.signin && !opts.formData.redir && !opts.formData.crumb) throw new Error('Login error: could not get login form for ' + opts.url);
    return this.opts = opts;
  };

  /**
   * Log into Slack and populate cookies.
   */

  this.login = function *() {
    var opts = this.opts;
    var load = {
      url: opts.url + loginFormPath,
      jar: opts.jar,
      method: 'POST',
      followAllRedirects: true,
      formData: opts.formData
    };
    var res = yield request(load);
    return this.opts = opts;
  };

  /**
   * Get the emoji upload page.
   */

  this.emoji = function *() {
    var opts = this.opts;
    var load = {
      url: opts.url + emojiUploadFormPath,
      jar: opts.jar,
      method: 'GET'
    };
    var res = yield request(load);
    var $ = cheerio.load(res[0].body);
    if (this.debug) write($('title').text(), $.html());
    opts.deletedCrumb = $('#custom_emoji form > input[name="remove"]').attr('value');
    console.log("Deleted crumb is %s", opts.deletedCrumb);
    if (!opts.deletedCrumb) throw new Error('Login error: could not get emoji deleted crumb for ' + opts.url);
    return this.opts = opts;
  };

  /**
   * Upload the emoji.
   */

  this.deleted = function *(name) {
    console.log('Deleting %s ', name);
    return new Promise(function(resolve, reject, notify) {
      var opts = this.opts;
      var r = req({
        url: opts.url + emojiUploadImagePath,
        method: 'POST',
        jar: opts.jar,
        followAllRedirects: true
      }, function(err, res, body) {
        if (err || !body) return reject(err);
        resolve(body);
      });
      var form = r.form();
      form.append('removed', '1');
      form.append('crumb', opts.deletedCrumb);
	  form.append('remove', name);
      // form.append('name', name);
      // form.append('mode', 'data');
      // form.append('img', req(emoji));
    }.bind(this));
  };
}
