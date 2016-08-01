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
const palette = require('hubot-ibmcloud-utils').palette;
const activity = require('hubot-ibmcloud-activity-emitter');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

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

const SHOW_MY_SERVICES = /service\s+((show|list)\s+((my)*\s+)*space)/i;


module.exports = (robot) => {

	// Natural Language match
	robot.on('bluemix.space.services.list', (res) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processSpaceServiceList(robot, res);
	});

	// Fixed command match
	robot.respond(SHOW_MY_SERVICES, {id: 'bluemix.space.services.list'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processSpaceServiceList(robot, res);
	});

	// Common code
	function processSpaceServiceList(robot, res) {
		const activeSpace = cf.activeSpace(robot, res);

		let message = i18n.__('service.list.in.progress', activeSpace.name);
		robot.emit('ibmcloud.formatter', { response: res, message: message});

		robot.logger.info(`${TAG}: Asynch call using cf library to obtain space summary.`);
		cf.Spaces.getSummary(activeSpace.guid).then((result) => {
			let summaryStr = '';
			if (result) {
				summaryStr = JSON.stringify(result);
			}
			robot.logger.info(`${TAG}: cf library returned with summary ${summaryStr}.`);
			var services = result.services;
			const attachments = services.map((service) => {
				const attachment = {
					title: service.name,
					color: palette.normal
				};
				attachment.fields = [
					{title: 'service', value: service.service_plan.service.label, short: true},
					{title: 'plan', value: service.service_plan.name, short: true}
				];
				return attachment;
			});

			// Add the list of service names to the global cache for Natural Lang.
			var serviceNames = services.map(function(service){
				return service.name;
			});
			nlcconfig.updateGlobalParameterValues('IBMcloudServiceManagment_myservicename', serviceNames);

			robot.logger.info(`${TAG}: Showing services in current space ${activeSpace.name}.`);
			if (attachments.length === 0) {
				let message = i18n.__('service.none.found', activeSpace.name);
				robot.emit('ibmcloud.formatter', { response: res, message: message});
			}
			else {
				// Emit the app status as an attachment
				robot.emit('ibmcloud.formatter', {
					response: res,
					attachments
				});
			}
			activity.emitBotActivity(robot, res, { activity_id: 'activity.service.list.space', space_name: activeSpace.name, space_guid: activeSpace.guid});
		});
	};

};
