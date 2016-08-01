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

const UNBIND_SERVICE = /service\s+unbind/i;

// Slack entry point.
module.exports = (robot) => {

	var switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.service.unbind', (res) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processServiceUnbind(robot, res);
	});

	// Fixed command match
	robot.respond(UNBIND_SERVICE, {id: 'bluemix.service.unbind'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processServiceUnbind(robot, res);
	});

	// Common code
	function processServiceUnbind(robot, res) {
		const activeSpace = cf.activeSpace(robot, res);
		robot.logger.info(`${TAG}: Unbinding a service instance in space ${activeSpace.name}.`);

		let message = i18n.__('service.list.bound');
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
				robot.logger.error(`${TAG}: No service instances found in space ${activeSpace.name}; cannot perform unbind.`);
				let message = i18n.__('service.instances.not.found');
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				return;
			}

			// Prompt the user to select from among their service instances.
			// Iterate the list of services in this space and determine which are bound.
			var boundServices = [];
			var prompt = i18n.__('service.unbind.select');
			for (var i = 0; i < serviceInstances.length; i++) {
				if (serviceInstances[i].bound_app_count > 0) {
					boundServices.push(serviceInstances[i]);
					prompt += '\n' + boundServices.length + ' - ' + serviceInstances[i].name;
				}
			}

			// Verify bound services exist to take action on.
			if (boundServices.length === 0) {
				let message = i18n.__('service.none.bound');
				robot.emit('ibmcloud.formatter', { response: res, message: message});
				return;
			}

			var regex = new RegExp('([1-' + boundServices.length + ']+)');
			utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((response) => {
				var selection = parseInt(response.match[1], 10);
				var serviceInstanceIndex = parseInt(selection, 10);
				var serviceInstanceGuid = boundServices[serviceInstanceIndex - 1].guid;
				var serviceInstanceName = boundServices[serviceInstanceIndex - 1].name;

				// Build a list of all the apps that are bound to this service.
				prompt = i18n.__('service.unbind.select.app');
				var appsBound = [];
				var apps = spaceSummary.apps;
				for (var appIndex = 0; appIndex < apps.length; appIndex++) {
					for (var serviceIndex = 0; serviceIndex < apps[appIndex].service_names.length; serviceIndex++) {
						var serviceName = apps[appIndex].service_names[serviceIndex];
						if (serviceInstanceName === serviceName) {
							appsBound.push(apps[appIndex]);
							prompt += '\n' + appsBound.length + ' - ' + apps[appIndex].name;
						}
					}
				}

				// Prompt the user to select which app to unbind.
				var regex = new RegExp('([1-' + appsBound.length + ']+)');
				utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((response) => {
					selection = parseInt(response.match[1], 10);
					var app = appsBound[selection - 1];
					var appName = app.name;
					var appGuid = app.guid;

					let message = i18n.__('service.unbind.in.progress');
					robot.emit('ibmcloud.formatter', { response: res, message: message});

					// Find the service bindings GUID for this service and app.
					robot.logger.info(`${TAG}: Asynch call using cf library to get service instance binding for instance ${serviceInstanceGuid}.`);
					cf.ServiceInstances.getInstanceBindings(serviceInstanceGuid).then((result) => {
						robot.logger.info(`${TAG}: Bindings results for instance ${serviceInstanceGuid} obtained.`);
						var bindings = result.resources;
						var binding = null;
						for (var i = 0; i < bindings.length; i++) {
							if (bindings[i].entity.app_guid === appGuid) {
								binding = bindings[i];
								break;
							}
						}

						if (!binding) {
							robot.logger.error(`${TAG}: No service bindings exist.`);
							let message = i18n.__('service.bind.not.found');
							robot.emit('ibmcloud.formatter', { response: res, message: message});
							return;
						}

						// Now take action action of unbinding.
						robot.logger.info(`${TAG}: Asynch call using cf library to remove service instance binding for instance ${serviceInstanceGuid} and binding guid ${binding.metadata.guid}.`);
						cf.ServiceBindings.remove(binding.metadata.guid).then((result) => {
							robot.logger.info(`${TAG}: Successfully remove service binding ${appName} for instance ${serviceInstanceGuid}.`);
							let message = i18n.__('service.unbind.success', serviceInstanceName, appName);
							robot.emit('ibmcloud.formatter', { response: res, message: message});
							activity.emitBotActivity(robot, res, {
								activity_id: 'activity.service.unbind',
								app_name: appName,
								app_guid: appGuid,
								space_name: activeSpace.name,
								space_guid: activeSpace.guid
							});
						});
					});
				});
			});
		});
	};

};
