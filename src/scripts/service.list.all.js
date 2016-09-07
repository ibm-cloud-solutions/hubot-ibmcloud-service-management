// Description:
//	Listens for commands to initiate actions against Bluemix
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User.
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

const path = require('path');
const TAG = path.basename(__filename);

const cf = require('hubot-cf-convenience');
const palette = require('hubot-ibmcloud-utils').palette;
const activity = require('hubot-ibmcloud-activity-emitter');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

// --------------------------------------------------------------
// i18n (internationalization)
// It will read from a peer messages.json file.  Later, these
// messages can be referenced throughout the module.
// --------------------------------------------------------------
const i18n = new (require('i18n-2'))({
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

const SHOW_ALL_SERVICES = /service\s+(show|list)\s+all/i;

module.exports = (robot) => {

	// Natural Language match
	robot.on('bluemix.service.list', (res) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processServiceListAll(robot, res);
	});

	// Fixed command match
	robot.respond(SHOW_ALL_SERVICES, {id: 'bluemix.service.list'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processServiceListAll(robot, res);
	});

	// Common code
	function processServiceListAll(robot, res) {
		robot.logger.info(`${TAG}: Showing all services.`);
		const attachments = cf.serviceCache.map((service) => {
			const attachment = {
				color: palette.normal
			};
			attachment.fields = [
				{title: service.display_name, value: service.description, short: true}
			];
			return attachment;
		});

		// Add the list of service names to the global cache for Natural Lang.
		let serviceNames = cf.serviceCache.map(function(service){
			return service.display_name;
		});
		nlcconfig.updateGlobalParameterValues('IBMcloudServiceManagment_servicename', serviceNames);

		// Emit the app status as an attachment
		robot.emit('ibmcloud.formatter', {
			response: res,
			attachments
		});

		activity.emitBotActivity(robot, res, { activity_id: 'activity.service.list.all'});
	}

};
