
const Alexa = require('ask-sdk-core');
const express = require('express');
const { ExpressAdapter } = require('ask-sdk-express-adapter');
const axios = require('axios');

SLACK_WEBHOOK_URL = ""
GITLAB_PIPELINE = ''
GITLAB_PIPELINE_TRIGGER_TOKEN = ''
GITLAB_PIPELINE_BRANCH = ''


function postToSlack(pipelineId, branchName, url, userName){

    var postData = JSON.stringify({
        "blocks": [
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `*Pipeline ${pipelineId}* triggered by ${userName} through Alexa. \n  ************* Pipeline Details ************* \n`
                }
            },
            {
                "type": "section",
                "text": {
                    "type": "mrkdwn",
                    "text": `Branch REF : \t ${branchName} \n Pipeline URL: \t ${url}`
                }
            }
        ]
    });

    console.log("Posting to Slack", postData);
    axios.post(SLACK_WEBHOOK_URL, postData)
    .then(res => {
        const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
        console.log('Status Code:', res.status);
        console.log('Date in Response header:', headerDate);
    })
    .catch(err => {
        console.log('Error notifying the slack channel about triggerd pipeline: ', err.message);
    });
}

function notifySlackChannel(message){
    var postData = JSON.stringify({
        'text' : message,
    });

    console.log("Posting to Slack", postData);
    axios.post(SLACK_WEBHOOK_URL, postData)
    .then(res => {
        console.log('Status Code:', res.status);
    })
    .catch(err => {
        console.log('Error notifying the slack channel about error in pipeline trigger: ', err.message);
    });
}

function triggerGitlabPipeline(){
    var data = {  
        "token": GITLAB_PIPELINE_TRIGGER_TOKEN,
        "ref": GITLAB_PIPELINE_BRANCH
    }

    console.log("Posting to Gitlab to trigger");
    axios.post(GITLAB_PIPELINE, data)
    .then(res => {
        const headerDate = res.headers && res.headers.date ? res.headers.date : 'no response date';
        console.log('Status Code:', res.status);
        if(res.status == 201){
            postToSlack(res.data.id, res.data.ref, res.data.web_url, res.data.user.name);
        }
        else{
            notifySlackChannel(`Response Status Code: ${res.status}`);
        }
        console.log('Date in Response header:', headerDate);
    })
    .catch(err => {
        console.log('Error triggering the pipeline: ', err.message);
        notifySlackChannel(err.message);
    });
}
    
  
const LaunchRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
      const speechText = 'Welcome to Voice Automated Triggering Service!';

      return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('Welcome to VATS!', speechText)
        .getResponse();
    }
};


const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = 'You can ask me the weather!';

        
        console.log("Invoking Help Intent");

        return handlerInput.responseBuilder
        .speak(speechText)
        .reprompt(speechText)
        .withSimpleCard('You can ask me the weather!', speechText)
        .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
          || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
      const speechText = 'Goodbye!';


      console.log("Cancel and Stop request");
  
      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard('Goodbye!', speechText)
        .withShouldEndSession(true)
        .getResponse();
    }
};


const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        
        console.log("Session End request");

      return handlerInput.responseBuilder.getResponse();
    }
};

const StartPipelineIntentHandler = {
    canHandle(handlerInput) {
      return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'StartPipelineIntent';
    },
    handle(handlerInput) {

      const repoName = Alexa.getSlotValue(handlerInput.requestEnvelope, 'repo');

      console.log(`Triggering the pipeline for ${repoName}`);
      const speechText = `Triggering the pipeline for ${repoName}`;

        //Your code goes here 
      triggerGitlabPipeline();

      return handlerInput.responseBuilder
        .speak(speechText)
        .withSimpleCard(`Triggering the pipeline for ${repoName}`, speechText)
        .getResponse();
    }
};

const FallbackIntentHandler = {
     canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
        && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speechText = 'Could not recognise the repository name';
  
  
        console.log("Cancel and Stop request");
    
        return handlerInput.responseBuilder
          .speak(speechText)
          .withSimpleCard("Try the  again with the repository name", speechText)
          .withShouldEndSession(false)
          .getResponse();
    }
  
  };

const ErrorHandler = {
    canHandle() {
      return true;
    },
    handle(handlerInput, error) {
      console.log(`Error handled: ${error.message}`);
  
      return handlerInput.responseBuilder
        .speak('Sorry, I don\'t understand your command. Please say it again.')
        .reprompt('Sorry, I don\'t understand your command. Please say it again.')
        .getResponse();
    }
};


const skill = Alexa.SkillBuilders.custom().addRequestHandlers(
    LaunchRequestHandler,
    StartPipelineIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    FallbackIntentHandler,
    SessionEndedRequestHandler).addErrorHandlers(ErrorHandler).create();

const app = express();

const PORT = 3002;
const HOST = '0.0.0.0';

const expressAdapter = new ExpressAdapter(skill, false, false);
app.post('/', expressAdapter.getRequestHandlers());
app.listen(PORT,HOST);
console.log(`Running on http://${HOST}:${PORT}`);