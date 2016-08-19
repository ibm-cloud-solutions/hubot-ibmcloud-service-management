// Description:
//	Listens for commands to initiate actions against Bluemix
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Author:
//	clanzen
//
/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

var path = require('path');
var TAG = path.basename(__filename);

const cf = require('hubot-cf-convenience');
const utils = require('hubot-ibmcloud-utils').utils;
const activity = require('hubot-ibmcloud-activity-emitter');
const Conversation = require('hubot-conversation');

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
var i18n = new (require('i18n-2'))({
	locales: ['en'],
	extension: '.json',
	// Add more languages to the list of locales when the files are created.
	directory: __dirname + '/../messages',
	defaultLocale: 'en',
	// Prevent messages file from being overwritten in error conditions (like poor JSON).
	updateFiles: false
});
// At some point we need to toggle this setting based on some user input.
i18n.setLocale('en');

const BIND_SERVICE = /service\s+bind/i;

// Slack entry point.
module.exports = (robot) => {

	var switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.service.bind', (res) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processServiceBind(robot, res);
	});

	// Fixed command match
	robot.respond(BIND_SERVICE, {id: 'bluemix.service.bind'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processServiceBind(robot, res);
	});

	// Common code
	function processServiceBind(robot, res) {
		const activeSpace = cf.activeSpace(robot, res);
		robot.logger.info(`${TAG}: Binding a service instance in space ${activeSpace.name}.`);

		let message = i18n.__('service.list.space');
		robot.emit('ibmcloud.formatter', { response: res, message: message});
		// Get the service instance.
		robot.logger.info(`${TAG}: Asynch call using cf library to obtain space summary.`);
		cf.Spaces.getSummary(activeSpace.guid).then((spaceSummary) => {
			let summaryStr = '';
			if (spaceSummary) {
				summaryStr = JSON.stringify(spaceSummary);
			}
			robot.logger.info(`${TAG}: cf library returned with summary ${summaryStr}.`);
			var serviceInstances = spaceSummary.services;
			// Verify there are service instances available.
			if (serviceInstances.length === 0) {
				let message = i18n.__('service.instances.not.found');
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				return;
			}

			// Prompt the user to select from among their service instances.
			var prompt = i18n.__('service.select.prompt');
			for (var i = 0; i < serviceInstances.length; i++) {
				prompt += '\n' + (i + 1) + ' - ' + serviceInstances[i].name;
			}

			var regex = utils.generateRegExpForNumberedList(serviceInstances.length);
			utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((selectionRes) => {
				var selection = parseInt(selectionRes.match[1], 10);
				var serviceInstanceIndex = parseInt(selection, 10);
				var serviceInstanceGuid = serviceInstances[serviceInstanceIndex - 1].guid;
				var serviceInstanceName = serviceInstances[serviceInstanceIndex - 1].name;

				// Build a list of all the apps that are bound to this service.
				prompt = i18n.__('service.bind.select.app');
				var apps = spaceSummary.apps;
				for (var i = 0; i < apps.length; i++) {
					prompt += '\n' + (i + 1) + ' - ' + apps[i].name;
				}

				// Prompt the user to select which app to unbind.
				var regex = utils.generateRegExpForNumberedList(apps.length);
				utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((selectionRes) => {
					selection = parseInt(selectionRes.match[1], 10);
					var app = apps[selection - 1];
					var appName = app.name;
					var appGuid = app.guid;

					let message = i18n.__('service.bind.in.progress');
					robot.emit('ibmcloud.formatter', { response: res, message: message});

					// Find the service bindings GUID for this service and app.

					robot.logger.info(`${TAG}: Asynch call using cf library to bind service instance ${serviceInstanceGuid} to app ${appName} of guid ${appGuid}.`);
					cf.ServiceBindings.associateServiceWithApp(serviceInstanceGuid, appGuid).then((result) => {
						robot.logger.info(`${TAG}: Bind service instance ${serviceInstanceGuid} to app ${appName} of guid ${appGuid} was successful.`);
						let message = i18n.__('service.bind.success', serviceInstanceName, appName);
						robot.emit('ibmcloud.formatter', { response: res, message: message});
						activity.emitBotActivity(robot, res, {
							activity_id: 'activity.service.bind',
							app_name: appName,
							app_guid: appGuid,
							space_name: activeSpace.name,
							space_guid: activeSpace.guid
						});
					}, (err) => {
						robot.logger.error(`${TAG}: Bind service instance ${serviceInstanceGuid} to app ${appName} of guid ${appGuid} failed with an error.`);
						robot.logger.error(err);
						let message = i18n.__('service.bind.failure');
						robot.emit('ibmcloud.formatter', { response: res, message: message});
					});
				});
			});
		});
	};

};
