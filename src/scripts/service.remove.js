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
const entities = require('../lib/service.entities');

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

const REMOVE_SERVICE = /service\s+(remove|delete|destroy)\s+(.*)/i;

module.exports = (robot) => {

	// Register entity handling functions
	entities.registerEntityFunctions();

	var switchBoard = new Conversation(robot);

	// Natural Language match
	robot.on('bluemix.service.remove', (res, parameters) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		if (parameters && parameters.myservicename) {
			processServiceRemove(robot, res, parameters.myservicename);
		}
		else {
			robot.logger.error(`${TAG}: Error extracting service name from text [${res.message.text}].`);
			robot.emit('ibmcloud.formatter', { response: res, message: i18n.__('cognitive.parse.problem.remove') });
		}
	});

	// Fixed command match
	robot.respond(REMOVE_SERVICE, {id: 'bluemix.service.remove'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		let serviceName = res.match[2];
		processServiceRemove(robot, res, serviceName);
	});

	// Common code
	function processServiceRemove(robot, res, serviceName) {
		const activeSpace = cf.activeSpace(robot, res);
		const spaceGuid = activeSpace.guid;
		robot.logger.info(`${TAG}: Removing service ${serviceName} from space ${activeSpace.name}.`);
		let prompt = i18n.__('service.instance.remove.prompt', serviceName);
		let negativeResponse = i18n.__('general.safe.this.time', serviceName);
		utils.getConfirmedResponse(res, switchBoard, prompt, negativeResponse).then((result) => {
			// Get a summary of the space to find the service instance GUID.
			robot.logger.info(`${TAG}: Asynch call using cf library to obtain space summary.`);
			cf.Spaces.getSummary(spaceGuid).then((result) => {
				let summaryStr = '';
				if (result) {
					summaryStr = JSON.stringify(result);
				}
				robot.logger.info(`${TAG}: cf library returned with summary ${summaryStr}.`);
				var services = result.services;
				var serviceInstanceGuid = null;
				// Iterate the list of services to find a match to the serviceName.
				for (var i = 0; i < services.length; i++) {
					if (serviceName === services[i].name) {
						serviceInstanceGuid = services[i].guid;
						break;
					}
				}
				// Verify GUID found.
				if (serviceInstanceGuid === null) {
					robot.logger.info(`${TAG}: ${serviceName} not found in ${activeSpace.name}.`);
					let message = i18n.__('service.instance.not.found', serviceName);
					robot.emit('ibmcloud.formatter', { response: res, message: message});
					return;
				}

				// Finally remove the service instance, per the GUID.
				robot.logger.info(`${TAG}: Asynch call using cf library to remove service instance ${serviceInstanceGuid}.`);
				cf.ServiceInstances.remove(serviceInstanceGuid).then((result) => {
					robot.logger.info(`${TAG}: Successfully remove service instance ${serviceName} with guid ${serviceInstanceGuid}.`);
					let message = i18n.__('service.instance.remove.success', serviceName);
					robot.emit('ibmcloud.formatter', { response: res, message: message});
					activity.emitBotActivity(robot, res, {
						activity_id: 'activity.service.remove',
						space_name: activeSpace.name,
						space_guid: activeSpace.guid
					});
				}, (err) => {
					robot.logger.error(`${TAG}: Error removing service instance ${serviceName} with guid ${serviceInstanceGuid}.`);
					robot.logger.error(err.stack);
					let message = i18n.__('service.instance.remove.error', JSON.parse(err).description);
					robot.emit('ibmcloud.formatter', { response: res, message: message});
				});

			}, (err) => {
				robot.logger.error(`${TAG}: Error getting summary for space ${spaceGuid}.`);
				robot.logger.error(err.stack);
				let message = i18n.__('space.summary.error', spaceGuid, err.stack);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
			});
		});
	};

};
