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
const activity = require('hubot-ibmcloud-activity-emitter');
const utils = require('hubot-ibmcloud-utils').utils;
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

const CREATE_SERVICE = /service\s+create\s+(.*)/i;

module.exports = (robot) => {

	var switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.service.create', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		if (parameters && parameters.servicename) {
			processServiceCreate(robot, res, parameters.servicename);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting service name from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('cognitive.parse.problem.create') });
		}
	});

	// Fixed command match
	robot.respond(CREATE_SERVICE, {id: 'bluemix.service.create'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		const service = res.match[1];
		processServiceCreate(robot, res, service);
	});

	// Common code
	function processServiceCreate(robot, res, service) {
		const activeSpace = cf.activeSpace(robot, res);
		robot.logger.info(`${TAG}: Creating a service instance ${service} in space ${activeSpace.name}`);

		// Get the service GUID for this service.
		const serviceGuid = cf.getServiceGuid(service);
		if (!serviceGuid || serviceGuid === null) {
			let message = i18n.__('service.not.found', service);
			robot.emit('ibmcloud.formatter', { response: res, message: message});
			robot.logger.info('User entered invalid service');
			return;
		}

		// Prompt for the name of the service, and read in the response.
		let prompt = i18n.__('service.name.prompt');
		utils.getExpectedResponse(res, robot, switchBoard, prompt, /(.*)/i).then((response) => {
			let name = response.match[1];
			let message = i18n.__('service.plans.get.list');
			robot.emit('ibmcloud.formatter', { response: res, message: message});

			// Look up the service plans for the selected service.
			robot.logger.info(`${TAG}: Asynch call using cf library to obtain service plans for service ${serviceGuid}.`);
			cf.Services.getServicePlans(serviceGuid).then((result) => {
				robot.logger.info(`${TAG}: Obtained service plans for service ${serviceGuid}.`);
				var prompt = i18n.__('service.plan.prompt');
				var plans = result.resources;
				for (var i = 0; i < plans.length; i++) {
					prompt += '\n' + (i + 1) + ' - ' + plans[i].entity.name;
				}

				let regex = utils.generateRegExpForNumberedList(plans.length);
				utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((response) => {
					var planIndex = parseInt(response.match[1], 10);

					// Find the service plan GUID based on the selection.
					var servicePlanGuid = plans[planIndex - 1].metadata.guid;
					let message = i18n.__('service.provision.in.progress');
					robot.emit('ibmcloud.formatter', { response: res, message: message});

					// We have good input. Build and send request to provision the service.
					robot.logger.info(`${TAG}: Asynch call using cf library to create service ${name} for service ${serviceGuid} at plan ${servicePlanGuid}.`);
					var body = {
						name: name,
						service_plan_guid: servicePlanGuid,
						space_guid: activeSpace.guid
					};
					cf.ServiceInstances.create(body).then((result) => {
						if (result.entity.last_operation != null
							&& result.entity.last_operation.state === 'succeeded'
							&& result.entity.last_operation.type === 'create') {
							robot.logger.info(`${TAG}: Service provisioning of ${name} for service ${serviceGuid} at plan ${servicePlanGuid} was successful.`);
							let message = i18n.__('service.provision.success', service, name);
							robot.emit('ibmcloud.formatter', { response: res, message: message});
							activity.emitBotActivity(robot, res, {
								activity_id: 'activity.service.create',
								space_name: activeSpace.name,
								space_guid: activeSpace.guid
							});
							var serviceInstanceGuid = result.metadata.guid;

							// Now prompt to see if this service should be bound to an app.
							let prompt = i18n.__('service.bind.prompt');
							let negativeResponse = i18n.__('service.bind.not.happening');
							utils.getConfirmedResponse(res, switchBoard, prompt, negativeResponse).then((result) => {
								let message = i18n.__('app.list.gathering');
								robot.emit('ibmcloud.formatter', { response: res, message: message});

								// Confirmed.  Show the list of apps and ask for a selection.
								cf.Spaces.getSummary(activeSpace.guid).then((result) => {
									// Iterate the apps and create a suitable response.
									prompt = i18n.__('app.select.prompt');
									var apps = result.apps;
									for (var i = 0; i < apps.length; i++) {
										prompt += '\n' + (i + 1) + ' - ' + apps[i].name;
									}
									let regex = utils.generateRegExpForNumberedList(apps.length);
									utils.getExpectedResponse(res, robot, switchBoard, prompt, regex).then((response) => {
										// Selection made.
										var appIndex = parseInt(response.match[1], 10);
										var appName = apps[appIndex - 1].name;
										var appGuid = apps[appIndex - 1].guid;

										let message = i18n.__('service.bind.in.progress');
										robot.emit('ibmcloud.formatter', { response: res, message: message});
										robot.logger.info('Binding service `' + service + '` to application `' + appName + '`.');
										cf.ServiceBindings.associateServiceWithApp(serviceInstanceGuid, appGuid).then((result) => {
											let message = i18n.__('service.bind.success', service, appName);
											robot.emit('ibmcloud.formatter', { response: res, message: message});
										}, (err) => {
											robot.logger.error(err);
											let message = i18n.__('service.bind.failure');
											robot.emit('ibmcloud.formatter', { response: res, message: message});
										});
									});
								});
							});
						}
						else {
							let resultStr = JSON.stringify(result);
							robot.logger.error(`${TAG}: Service provisioning of ${name} for service ${serviceGuid} at plan ${servicePlanGuid} failed. Result: ${resultStr}`);
							let message = i18n.__('service.provision.error', resultStr);
							robot.emit('ibmcloud.formatter', { response: res, message: message});
						}
					}, (err) => {
						let message = i18n.__('service.provision.error.unexpected', JSON.parse(err).description);
						robot.emit('ibmcloud.formatter', { response: res, message: message});
						robot.logger.error(`${TAG}: Service provisioning of ${name} for service ${serviceGuid} at plan ${servicePlanGuid} failed.`);
						robot.logger.error(err.stack);
					});

					return;
				});
			});
		});
	};

};
