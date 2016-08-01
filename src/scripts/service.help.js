// Description:
//	Listens for commands to initiate actions against Bluemix for services
//
// Configuration:
//	 HUBOT_BLUEMIX_API Bluemix API URL
//	 HUBOT_BLUEMIX_ORG Bluemix Organization
//	 HUBOT_BLUEMIX_SPACE Bluemix space
//	 HUBOT_BLUEMIX_USER Bluemix User ID
//	 HUBOT_BLUEMIX_PASSWORD Password for the Bluemix User
//
// Commands:
//   hubot service(s) help - Show available commands in the service category.
//
// Author:
//	chambrid
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

const SERVICE_HELP = /(service|services)\s+help/i;

module.exports = (robot) => {

	// Natural Language match
	robot.on('bluemix.service.help', (res) => {
		robot.logger.debug(`${TAG}: Natural Language match. res.message.text=${res.message.text}.`);
		processServiceHelp(robot, res);
	});

	// Fixed command match
	robot.respond(SERVICE_HELP, {id: 'bluemix.service.help'}, function(res) {
		robot.logger.debug(`${TAG}: res.message.text=${res.message.text}.`);
		processServiceHelp(robot, res);
	});

	// Common code
	function processServiceHelp(robot, res) {
		robot.logger.info('Listing help service...');
		// hubot service bind - Bind a service instance to an application.
		// hubot service create [service] - Create a service instance.
		// hubot service delete|remove|destroy [name] - Delete a service instance.
		// hubot service show|list all - Show all of the services available.
		// hubot service show|list space - Show the service instances in the active space.
		// hubot service unbind - Unbind a service instance from an application.

		let help = robot.name + ' service bind - ' + i18n.__('help.service.bind') + '\n';
		help += robot.name + ' service create [service] - ' + i18n.__('help.service.create') + '\n';
		help += robot.name + ' service delete|remove|destroy [service] - ' + i18n.__('help.service.delete') + '\n';
		help += robot.name + ' service show|list all - ' + i18n.__('help.service.show.all') + '\n';
		help += robot.name + ' service show|list space - ' + i18n.__('help.service.show.space') + '\n';
		help += robot.name + ' service unbind - ' + i18n.__('help.service.unbind') + '\n';

		let message = '\n' + help;
		robot.emit('ibmcloud.formatter', { response: res, message: message});
	};
};
