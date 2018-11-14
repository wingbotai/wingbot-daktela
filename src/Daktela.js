/*
 * @author David Menger
 */
'use strict';

const { Request } = require('wingbot');
const request = require('request-promise-native');
const DaktelaSender = require('./DaktelaSender');

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
     * @param {string} [options.pageId] - custom page ID
     * @param {Function} [options.requestLib] - request library replacement for testing
     * @param {console} [senderLogger] - optional console like chat logger
     */
    constructor (processor, options, senderLogger = null) {
        this._options = {
            terminateAction: null,
            pageId: 'daktela'
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
        const opts = {};

        return new DaktelaSender(opts, senderId, body, this._senderLogger, this._request);
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

        if (!name || !time || !conversation || typeof conversation !== 'object') {
            return [];
        }

        const timestamp = this._createTimestamp(time, name).getTime();
        const senderId = conversation.name;

        let req;

        if (button) {
            const [action, data = {}] = JSON.parse(button.name);
            req = Request.postBack(
                senderId,
                action,
                data,
                null,
                {},
                timestamp
            );
        } else if (quickreply) {
            const [action, data = {}] = JSON.parse(quickreply.name);

            if (text) {
                req = Request.quickReplyText(
                    senderId,
                    text,
                    JSON.stringify({ action, data }),
                    timestamp
                );
            } else {
                req = Request.quickReply(
                    senderId,
                    action,
                    data,
                    timestamp
                );
            }
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
        }

        if (!req) {
            return [];
        }

        const messageSender = await this._createSender(body, senderId);

        const { pageId } = this._options;

        return this.processor.processMessage(req, pageId, messageSender, { conversation });
    }

    _createTimestamp (time, name) {
        const date = new Date(time);
        const [, ms = '0'] = name
            .replace(/[^0-9]+/g, '')
            .match(/([0-9]{1,3})?$/);

        date.setMilliseconds(parseInt(ms, 10));

        return date;
    }

    /**
     * Verify Facebook webhook event
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
