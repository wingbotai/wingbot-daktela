/*
 * @author David Menger
 */
'use strict';

const { Request } = require('wingbot');
const request = require('request-promise-native');
const DaktelaSender = require('./DaktelaSender');

/**
 * @typedef {Object} ActionReplacer
 */
const actionReplacer = {
    async actionToReplacement (action, data) {
        const buf = Buffer.from(JSON.stringify([action, data]));

        return buf.toString('base64');
    },
    async replacementToAction (replacement) {
        const buf = Buffer.from(replacement, 'base64');
        const [action, data = {}] = JSON.parse(buf.toString('utf8'));
        return { action, data };
    }
};

/**
 * @typedef {Object} Processor
 * @param {Function} processMessage
 */

/**
 * Daktela connector for wingbot.ai chatbot
 *
 * @class
 */
class Daktela {

    /**
     *
     * @param {Processor} processor - wingbot Processor instance
     * @param {Object} options
     * @param {string} [options.terminateAction] - conversation termination postback
     * @param {string} [options.welcomeAction] - conversation termination postback
     * @param {ActionReplacer} [options.actionReplacer] - conversation termination postback
     * @param {string} [options.pageId] - custom page ID
     * @param {Function} [options.requestLib] - request library replacement for testing
     * @param {console} [senderLogger] - optional console like chat logger
     */
    constructor (processor, options, senderLogger = null) {
        this._options = {
            terminateAction: null,
            pageId: 'daktela',
            welcomeAction: null,
            actionReplacer
        };

        Object.assign(this._options, options);

        this.processor = processor;
        this._senderLogger = senderLogger;

        this._request = options.requestLib || request;
    }

    async processMessage (message, senderId, pageId) { // eslint-disable-line no-unused-vars

        return {
            status: 204, // not sent
            responses: []
        };
    }

    /**
     *
     * @private
     * @param {Object} body - event body
     * @param {string} senderId
     */
    async _createSender (body, senderId) {
        return new DaktelaSender(this._options, senderId, body, this._senderLogger, this._request);
    }

    /**
     * Process Facebook request
     *
     * @param {Object} body - event body
     * @returns {Promise<Array<{message:Object,pageId:string}>>} - unprocessed events
     */
    async processEvent (body) {
        const {
            name,
            time,
            conversation,
            text = null,
            quickreply = null,
            button = null,
            terminate = null
        } = body;

        if (!conversation || typeof conversation !== 'object') {
            return [];
        }

        const timestamp = this._createTimestamp(time, name).getTime();
        const senderId = conversation.name;

        let req;

        if (button) {
            const { action, data, setState } = await this._options.actionReplacer
                .replacementToAction(button.name);

            if (setState) {
                req = Request.postBackWithSetState(
                    senderId,
                    action,
                    data,
                    setState,
                    timestamp
                );
            } else {
                req = Request.postBack(
                    senderId,
                    action,
                    data,
                    null,
                    {},
                    timestamp
                );
            }

        } else if (quickreply) {
            const { action, data, setState } = await this._options.actionReplacer
                .replacementToAction(quickreply.name);

            req = Request.quickReplyText(
                senderId,
                text || action,
                JSON.stringify({ action, data, setState }),
                timestamp
            );
        } else if (terminate && this._options.terminateAction) {
            req = Request.postBack(
                senderId,
                this._options.terminateAction,
                { terminate },
                null,
                {},
                timestamp
            );
        } else if (text) {
            req = Request.text(
                senderId,
                text,
                timestamp
            );
        } else if (!name && !time && this._options.welcomeAction) {
            // the start event

            req = Request.postBack(
                senderId,
                this._options.welcomeAction,
                {},
                null,
                {},
                timestamp
            );
        }

        if (!req) {
            return [];
        }

        const messageSender = await this._createSender(body, senderId);

        const { pageId } = this._options;

        return this.processor.processMessage(req, pageId, messageSender, { conversation });
    }

    _createTimestamp (time, name) {
        const date = new Date(time || Date.now());
        const [, ms = '0'] = (name || '000')
            .replace(/[^0-9]+/g, '')
            .match(/([0-9]{1,3})?$/);

        date.setMilliseconds(parseInt(ms, 10));

        return date;
    }

    /**
     * Verify webhook event
     *
     * @param {Object} body - parsed request body
     * @param {Object} headers - request headers
     * @returns {Promise}
     * @throws {Error} when authorization token is invalid or missing
     */
    async verifyRequest (body, headers) { // eslint-disable-line no-unused-vars
        // @todo make verification
    }

}

module.exports = Daktela;
