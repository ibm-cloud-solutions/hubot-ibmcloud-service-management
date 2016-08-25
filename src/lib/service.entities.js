/*
  * Licensed Materials - Property of IBM
  * (C) Copyright IBM Corp. 2016. All Rights Reserved.
  * US Government Users Restricted Rights - Use, duplication or
  * disclosure restricted by GSA ADP Schedule Contract with IBM Corp.
  */
'use strict';

const cf = require('hubot-cf-convenience');
const nlcconfig = require('hubot-ibmcloud-cognitive-lib').nlcconfig;

const NAMESPACE = 'IBMcloudServiceManagment';
const PARAM_MYSERVICENAME = 'myservicename';

var functionsRegistered = false;


function buildGlobalName(parameterName) {
	return NAMESPACE + '_' + parameterName;
}
function buildGlobalFuncName(parameterName) {
	return NAMESPACE + '_func' + parameterName;
}

function registerEntityFunctions() {
	if (!functionsRegistered) {
		nlcconfig.setGlobalEntityFunction(buildGlobalFuncName(PARAM_MYSERVICENAME), getMyServiceNames);
		functionsRegistered = true;
	}
}

function getMyServiceNames(robot, res, parameterName, parameters) {
	return new Promise(function(resolve, reject) {
		const activeSpace = cf.activeSpace(robot, res);
		cf.Spaces.getSummary(activeSpace.guid).then((result) => {
			var myServiceNames = result.services.map(function(service){
				return service.name;
			});
			nlcconfig.updateGlobalParameterValues(buildGlobalName(PARAM_MYSERVICENAME), myServiceNames);
			resolve(myServiceNames);
		}).catch(function(err) {
			reject(err);
		});
	});
}

module.exports.registerEntityFunctions = registerEntityFunctions;
module.exports.getMyServiceNames = getMyServiceNames;
