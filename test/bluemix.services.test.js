/*
 * Licensed Materials - Property of IBM
 * (C) Copyright IBM Corp. 2016. All Rights Reserved.
 * US Government Users Restricted Rights - Use, duplication or
 * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
 */

// ------------------------------------------------------
// TODO: TESTS TO ADD - Need special case test.resources
// Test: create: existing service name
// Test: create: valid service and plan, no apps available to bind
// Test: bind: no services available
// Test: bind: valid service, no apps to bind to
// Test: bind: valid service, invalid app selected, exit
// Test: unbind: no bound services
// Test: remove service that is still bound.
// ------------------------------------------------------

'use strict';

const Helper = require('hubot-test-helper');
const helper = new Helper('../src/scripts');
const expect = require('chai').expect;
const mockUtils = require('./mock.utils.cf.js');
const mockESUtils = require('./mock.utils.es.js');
const sprinkles = require('mocha-sprinkles');

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

const timeout = 1000;

function waitForMessageQueue(room, len){
	return sprinkles.eventually({
		timeout: timeout
	}, function() {
		if (room.messages.length < len) {
			throw new Error('too soon');
		}
	}).then(() => false).catch(() => true).then((success) => {
		// Great.  Move on to tests
		expect(room.messages.length).to.eql(len);
	});
}

// Passing arrow functions to mocha is discouraged: https://mochajs.org/#arrow-functions
// return promises from mocha tests rather than calling done() - http://tobyho.com/2015/12/16/mocha-with-promises/
describe('Interacting with Bluemix via Slack', function() {

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
		// Force all emits into a reply.
		room.robot.on('ibmcloud.formatter', function(event) {
			if (event.message) {
				event.response.reply(event.message);
			}
			else {
				event.response.send({attachments: event.attachments});
			}
		});
	});

	afterEach(function() {
		room.destroy();
	});

	// ------------------------------------------------------
	// Test: create: valid service name and plan, no bind
	// ------------------------------------------------------
	context('Create a service: valid name and plan, no bind', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service create validService1').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.name.prompt')]);
				return room.user.say('mimiron', '@hubot validService1Name');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plans.get.list')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plan.prompt') +
					'\n1 - servicePlan1Name\n2 - servicePlan2Name'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 3];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.in.progress')]);
				response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.success', 'validService1',
					'validService1Name')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.prompt')]);
				return room.user.say('mimiron', '@hubot no');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.not.happening')]);
			});
		});
	});

	// ------------------------------------------------------
	// Test: create: invalid service name
	// ------------------------------------------------------
	context('Create a service: invalid name', function() {
		beforeEach(function() {
			// Don't move on from this until the promise resolves
			return room.user.say('mimiron', '@hubot service create invalidService');
		});

		it('Should respond with invalid name error.', function() {
			expect(room.messages[1]).to.eql(['hubot',
				'@mimiron ' + i18n.__('service.not.found', 'invalidService')
			]);
		});
	});

	// ------------------------------------------------------
	// Test: create: valid service name, bad plan
	// ------------------------------------------------------
	context('Create a service: valid name, bad plan and exit', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service create validService1').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.name.prompt')]);
				return room.user.say('mimiron', '@hubot validService1Name');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plans.get.list')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plan.prompt') +
					'\n1 - servicePlan1Name\n2 - servicePlan2Name'
				]);
				return room.user.say('mimiron', '@hubot 3');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response[1]).to.contain('That is not one of the choices. Try again');
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plan.prompt') +
					'\n1 - servicePlan1Name\n2 - servicePlan2Name'
				]);
				return room.user.say('mimiron', '@hubot exit');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['mimiron', '@hubot exit']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: create: valid service and plan, bind to existing app
	// ------------------------------------------------------
	context('Create a service: valid name and plan, bind to app', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service create validService1').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.name.prompt')]);
				return room.user.say('mimiron', '@hubot validService1Name');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plans.get.list')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plan.prompt') +
					'\n1 - servicePlan1Name\n2 - servicePlan2Name'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 3];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.in.progress')]);
				response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.success', 'validService1',
					'validService1Name')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.prompt')]);
				return room.user.say('mimiron', '@hubot yes');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.list.gathering')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.select.prompt') +
					'\n1 - testApp1Name\n2 - testApp2Name\n3 - testApp4Name\n4 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.in.progress')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.success', 'validService1',
					'testApp1Name')]);
			});
		});
	});

	// ------------------------------------------------------
	// Test: create: valid service and plan, exit from selecting app to bind
	// ------------------------------------------------------
	context('Create a service: valid name and plan, invalid app to bind and exit', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service create validService1').then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.name.prompt')]);
				return room.user.say('mimiron', '@hubot validService1Name');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plans.get.list')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.plan.prompt') +
					'\n1 - servicePlan1Name\n2 - servicePlan2Name'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 3];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.in.progress')]);
				response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.provision.success', 'validService1',
					'validService1Name')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.prompt')]);
				return room.user.say('mimiron', '@hubot yes');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.list.gathering')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.select.prompt') +
					'\n1 - testApp1Name\n2 - testApp2Name\n3 - testApp4Name\n4 - testAppLongLogsName'
				]);
				expect(response).to.eql(['hubot',
					'@mimiron Select the application.\n1 - testApp1Name\n2 - testApp2Name\n3 - testApp4Name\n4 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot garbage');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response[1]).to.contain('That is not one of the choices. Try again');
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('app.select.prompt') +
					'\n1 - testApp1Name\n2 - testApp2Name\n3 - testApp4Name\n4 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot exit');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['mimiron', '@hubot exit']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: bind: select valid service, valid app
	// ------------------------------------------------------
	context('Bind a service: valid service, bind to app', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service bind').then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.space')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.select.prompt') +
					'\n1 - validService1\n2 - validService2'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.select.app') +
					'\n1 - testApp1Name\n2 - testApp2Name\n3 - testApp4Name\n4 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.in.progress')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.bind.success', 'validService1',
					'testApp1Name')]);
			});
		});
	});

	// ------------------------------------------------------
	// Test: bind: invalid service selected, exit
	// ------------------------------------------------------
	context('Bind a service: invalid service, exit out', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service bind').then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.space')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.select.prompt') +
					'\n1 - validService1\n2 - validService2'
				]);
				return room.user.say('mimiron', '@hubot 5');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response[1]).to.contain('That is not one of the choices. Try again');
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.select.prompt') +
					'\n1 - validService1\n2 - validService2'
				]);
				return room.user.say('mimiron', '@hubot exit');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['mimiron', '@hubot exit']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: unbind: select valid service that is bound
	// ------------------------------------------------------
	context('Unbind a service: valid service that is bound to an app', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service unbind').then(() => {
				return waitForMessageQueue(room, 3);
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.bound')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select') + '\n1 - validService1']);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				return waitForMessageQueue(room, 5);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select.app') +
					'\n1 - testApp1Name\n2 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				return waitForMessageQueue(room, 8);
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.in.progress')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.success', 'validService1',
					'testApp1Name')]);
			});
		});
	});

	// ------------------------------------------------------
	// Test: unbind: invalid service selected, exit out
	// ------------------------------------------------------
	context('Unbind a service: invalid service selected, exit out', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service unbind').then(() => {
				return waitForMessageQueue(room, 3);
			}).then(() => {
				console.log('messages 1: ' + JSON.stringify(room.messages));
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.bound')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select') + '\n1 - validService1']);
				return room.user.say('mimiron', '@hubot 55');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response[1]).to.contain('That is not one of the choices. Try again');
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select') + '\n1 - validService1']);
				return room.user.say('mimiron', '@hubot exit');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['mimiron', '@hubot exit']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: unbind: valid service, invalid app selected, exit
	// ------------------------------------------------------
	context('Unbind a service: valid service invalid app selected, exit out', function() {
		it('Should have a clean conversation.', function() {
			return room.user.say('mimiron', '@hubot service unbind').then(() => {
				return waitForMessageQueue(room, 3);
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.bound')]);
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select') + '\n1 - validService1']);
				return room.user.say('mimiron', '@hubot 1');
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select.app') +
					'\n1 - testApp1Name\n2 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot 55');
			}).then(() => {
				let response = room.messages[room.messages.length - 2];
				expect(response[1]).to.contain('That is not one of the choices. Try again');
				response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.unbind.select.app') +
					'\n1 - testApp1Name\n2 - testAppLongLogsName'
				]);
				return room.user.say('mimiron', '@hubot exit');
			}).then(() => {
				// No response expected.
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['mimiron', '@hubot exit']);
			});
		});
	});

	// ------------------------------------------------------
	// Test: show all services
	// ------------------------------------------------------
	context('Show all services', function() {
		it('should report a list of the services.', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.attachments.length).to.eql(2);
				expect(event.attachments[0].fields[0].title).to.eql('validService1');
				expect(event.attachments[1].fields[0].title).to.eql('validService2');
				done();
			});
			room.user.say('mimiron', '@hubot service list all').then();
		});
	});

	// ------------------------------------------------------
	// Test: list all services
	// ------------------------------------------------------
	context('List all services', function() {
		it('should report a list of the services.', function(done) {
			room.robot.on('ibmcloud.formatter', function(event) {
				expect(event.attachments.length).to.eql(2);
				expect(event.attachments[0].fields[0].title).to.eql('validService1');
				expect(event.attachments[1].fields[0].title).to.eql('validService2');
				done();
			});
			room.user.say('mimiron', '@hubot service list all').then();
		});
	});

	// ------------------------------------------------------
	// Test: show my services
	// ------------------------------------------------------
	context('Show my services', function() {
		it('should report a list of only my services.', function() {
			return room.user.say('mimiron', '@hubot service show space').then(() => {
				expect(room.messages.length).to.eql(3);
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.in.progress', 'testSpace')]);
				let event = room.messages[room.messages.length - 1][1];
				expect(event.attachments).to.not.eql(null);
				expect(event.attachments.length).to.eql(2);
				expect(event.attachments[0].fields[0].title).to.eql('service');
				expect(event.attachments[0].fields[0].value).to.eql('validServicePlan1Label');
				expect(event.attachments[0].fields[1].title).to.eql('plan');
				expect(event.attachments[0].fields[1].value).to.eql('validServicePlan1Name');
				expect(event.attachments[1].fields[0].title).to.eql('service');
				expect(event.attachments[1].fields[0].value).to.eql('validServicePlan2Label');
				expect(event.attachments[1].fields[1].title).to.eql('plan');
				expect(event.attachments[1].fields[1].value).to.eql('validServicePlan2Name');
			});
		});
	});

	// ------------------------------------------------------
	// Test: list my services
	// ------------------------------------------------------
	context('List my services', function() {
		it('should report a list of only my services.', function() {
			return room.user.say('mimiron', '@hubot service list space').then(() => {
				expect(room.messages.length).to.eql(3);
				let response = room.messages[room.messages.length - 2];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.list.in.progress', 'testSpace')]);
				let event = room.messages[room.messages.length - 1][1];
				expect(event.attachments).to.not.eql(null);
				expect(event.attachments.length).to.eql(2);
				expect(event.attachments[0].fields[0].title).to.eql('service');
				expect(event.attachments[0].fields[0].value).to.eql('validServicePlan1Label');
				expect(event.attachments[0].fields[1].title).to.eql('plan');
				expect(event.attachments[0].fields[1].value).to.eql('validServicePlan1Name');
				expect(event.attachments[1].fields[0].title).to.eql('service');
				expect(event.attachments[1].fields[0].value).to.eql('validServicePlan2Label');
				expect(event.attachments[1].fields[1].title).to.eql('plan');
				expect(event.attachments[1].fields[1].value).to.eql('validServicePlan2Name');
			});
		});
	});

	// ------------------------------------------------------
	// Test: remove service validService
	// ------------------------------------------------------
	context('Removing an existing, unbound service', function() {
		it('should produce a successful removal message', function() {
			return room.user.say('mimiron', '@hubot service remove validService1').then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.instance.remove.prompt', 'validService1')]);
				return room.user.say('mimiron', '@hubot yes');
			}).then(() => {
				return waitForMessageQueue(room, 4);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.instance.remove.success', 'validService1')]);
			});
		});
	});

	// ------------------------------------------------------
	// Test: remove service invalidService
	// ------------------------------------------------------
	context('Removing an nonexisting service', function() {
		it('should produce a not found error message', function() {
			return room.user.say('mimiron', '@hubot service remove garbage').then(() => {
				return waitForMessageQueue(room, 2);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.instance.remove.prompt', 'garbage')]);
				return room.user.say('mimiron', '@hubot yes');
			}).then(() => {
				return waitForMessageQueue(room, 4);
			}).then(() => {
				let response = room.messages[room.messages.length - 1];
				expect(response).to.eql(['hubot', '@mimiron ' + i18n.__('service.instance.not.found', 'garbage')]);
			});
		});
	});

	context('user calls `service help`', function() {
		beforeEach(function() {
			return room.user.say('mimiron', '@hubot service help');
		});

		it('should respond with help', function() {
			expect(room.messages.length).to.eql(2);

			let help = 'hubot service bind - ' + i18n.__('help.service.bind') + '\n' +
				'hubot service create [service] - ' + i18n.__('help.service.create') + '\n' +
				'hubot service delete|remove|destroy [service] - ' + i18n.__('help.service.delete') + '\n' +
				'hubot service show|list all - ' + i18n.__('help.service.show.all') + '\n' +
				'hubot service show|list space - ' + i18n.__('help.service.show.space') + '\n' +
				'hubot service unbind - ' + i18n.__('help.service.unbind') + '\n';

			expect(room.messages[1]).to.eql(['hubot', '@mimiron \n' + help]);
		});
	});
});
