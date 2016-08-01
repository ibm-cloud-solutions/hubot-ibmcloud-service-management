/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

'use strict';

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
const mockUtils = require('./mock.utils.cf.js');
const mockESUtils = require('./mock.utils.es.js');

var i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../src/messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Bluemix services via Slack / Natural Language', function() {

	let room;
	let cf;

	before(function() {
		mockUtils.setupMockery();
		mockESUtils.setupMockery();
		// initialize cf, hubot-test-helper doesn't test Middleware
		cf = require('hubot-cf-convenience');
		return cf.promise.then();
	});

	beforeEach(function() {
		room = helper.createRoom();
	});

	afterEach(function() {
		room.destroy();
	});

	// ------------------------------------------------------
	// Test: create
	// ------------------------------------------------------
	context('Create service - user says `Build service validService1` ', function() {
		it('should recognize command and prompt for a name', function(done) {
			// This will get called if the NLC command was recognized.
			var replyFn = function(msg) {
				expect(msg).to.eql(i18n.__('service.name.prompt'));
				done();
			};

			var res = { message: {text: 'Build service validService1', user: { id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.service.create', res, { servicename: 'validService1'});
		});
	});

	// ------------------------------------------------------
	// Test: bind
	// ------------------------------------------------------
	context('Bind service - user says `Attach my service` ', function() {
		it('should recognize command and say it is listing the services in space', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.eql(i18n.__('service.list.space'));
				done();
			});

			var res = { message: {text: 'Bind my service', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.service.bind', res);
		});
	});

	// ------------------------------------------------------
	// Test: unbind
	// ------------------------------------------------------
	context('Unbind service - user says `Unhinge my service` ', function() {
		it('should recognize command and say it is listing the services in space', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.eql(i18n.__('service.list.bound'));
				done();
			});

			var res = { message: {text: 'Unhinge my service', user: { id: 'mimiron'}}, response: room };
			room.robot.emit('bluemix.service.unbind', res);
		});
	});

	// ------------------------------------------------------
	// Test: list
	// ------------------------------------------------------
	context('List all serviceNames - user says `Show Bluemix services` ', function() {
		it('should recognize command and present a list of services', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.attachments.length).to.eql(2);
				expect(event.attachments[0].fields[0].title).to.eql('validService1');
				expect(event.attachments[1].fields[0].title).to.eql('validService2');
				done();
			});

			var res = { message: {text: 'Show Bluemix services', response: room }};
			room.robot.emit('bluemix.service.list', res);
		});
	});

	// ------------------------------------------------------
	// Test: list space
	// ------------------------------------------------------
	context('List service space - user says `Show services in my space` ', function() {
		it('should recognize command and say it is listing the services in space', function(done) {
			// Listens for dialog response.
			room.robot.on('ibmcloud.formatter', (event) => {
				expect(event.message).to.eql(i18n.__('service.list.in.progress', 'testSpace'));
				done();
			});

			var res = { message: {text: 'Show services in my space', response: room }};
			room.robot.emit('bluemix.space.services.list', res);
		});
	});

	// ------------------------------------------------------
	// Test: remove
	// ------------------------------------------------------
	context('Remove service - user says `Eliminate my service validService1` ', function() {
		it('should recognize command and prompt to be sure', function(done) {
			// This will get called if the NLC command was recognized.
			var replyFn = function(msg) {
				expect(msg).to.eql(i18n.__('service.instance.remove.prompt', 'validService1'));
				done();
			};

			var res = { message: {text: 'Eliminate my service validService1', user: { id: 'mimiron'}}, response: room, reply: replyFn };
			room.robot.emit('bluemix.service.remove', res, { myservicename: 'validService1'});
		});
	});

});
