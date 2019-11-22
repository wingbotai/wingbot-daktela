'use strict';

const sinon = require('sinon');
const assert = require('assert');
const {
    Tester, Router
} = require('wingbot');
const Daktela = require('../src/Daktela');

function createSendMock () {
    return sinon.spy(data => Promise.resolve({ result: 'OK', data }));
}

const SENDER_ID = 'senderid';
const TEST_URL = 'http://www.foobar.com/api';

/**
 *
 * @param {Date} date
 * @param {string} expected
 */
function assertDate (date, expected) {
    date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
    assert.equal(date.toISOString(), expected);
}

describe('<Daktela>', () => {

    describe('#_createTimestamp()', () => {

        it('uses name and date to make a timestamp', () => {
            const t = new Tester(new Router());
            const d = new Daktela(t.processor, {});

            let res = d._createTimestamp('2018-11-14 11:54:26', 'ab123');
            assertDate(res, '2018-11-14T11:54:26.123Z');

            res = d._createTimestamp('2018-11-14 11:54:26', 'xyz01');
            assertDate(res, '2018-11-14T11:54:26.001Z');

            res = d._createTimestamp('2018-11-14 11:54:26', 'haha');
            assertDate(res, '2018-11-14T11:54:26.000Z');

        });

    });

    describe('#processEvent()', () => {

        /** @type {Daktela} */
        let da;

        /** @type {Tester} */
        let t;

        /** @type {sinon.SinonSpy} */
        let requestLib;

        let k = 0;

        function daktelaRequest (extend) {
            const d = new Date();

            const p = n => (`${n}`.length === 1 ? `0${n}` : n);

            return Object.assign({
                conversation: {
                    name: SENDER_ID,
                    response_url: TEST_URL
                },
                direction: 'IN',
                name: `${d.getTime()}${k++}`,
                time: `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
            }, extend);
        }

        beforeEach(() => {
            const bot = new Router();

            bot.use('start', (req, res) => {
                res.text('Started', {
                    qrAction: 'Foo'
                });
            });

            bot.use('qrAction', (req, res) => {
                const btn = res.button('Button text');

                btn.urlButton('url btn title', 'https://www.seznam.cz');
                btn.postBackButton('postback title', 'action');

                btn.send();
            });

            // @ts-ignore
            bot.use(['text-action', /^foo-bar$/], (req, res) => {
                res.passThread('123');
            });

            bot.use('terminated', (req, res) => {
                const actionData = req.action(true);
                res.text(JSON.stringify(actionData));
            });

            requestLib = createSendMock();
            t = new Tester(bot);
            da = new Daktela(t.processor, {
                requestLib,
                terminateAction: 'terminated'
            });
        });

        it('accepts postbacks', async () => {
            await da.processEvent(daktelaRequest({
                button: { name: Buffer.from('["start"]').toString('base64') }
            }));

            assert.deepEqual(requestLib.getCall(0).args[0].body, {
                text: 'Started',
                quickreply: [
                    {
                        text: 'Foo',
                        name: Buffer.from('["/qrAction",{}]').toString('base64')
                    }
                ],
                conversation: { name: SENDER_ID }
            });

            assert.equal(requestLib.getCall(0).args[0].uri, TEST_URL);
        });

        it('accepts quick replies and sends buttons', async () => {
            await da.processEvent(daktelaRequest({
                quickreply: { name: Buffer.from('["/qrAction",{}]').toString('base64') },
                text: 'Foo'
            }));

            assert.deepEqual(requestLib.getCall(0).args[0].body, {
                text: 'Button text',
                quickreply: [],
                button: [
                    {
                        text: 'url btn title',
                        name: '4c3cb74706a0d5746c576d233c0a4dca770f7acf',
                        url: 'https://www.seznam.cz'
                    },
                    {
                        text: 'postback title',
                        name: Buffer.from('["/action",{}]').toString('base64')
                    }
                ],
                conversation: { name: SENDER_ID }
            });
            assert.equal(requestLib.getCall(0).args[0].uri, TEST_URL);
        });

        it('accepts texts and sends chat terminations', async () => {
            await da.processEvent(daktelaRequest({
                text: 'Foo BAR'
            }));

            assert.deepEqual(requestLib.getCall(0).args[0].body, {
                transfer: 123,
                quickreply: [],
                conversation: { name: SENDER_ID }
            });
            assert.equal(requestLib.getCall(0).args[0].uri, TEST_URL);
        });

        it('translates termination to action', async () => {
            await da.processEvent(daktelaRequest({
                terminate: 123
            }));

            assert.deepEqual(requestLib.getCall(0).args[0].body, {
                text: '{"terminate":123}',
                quickreply: [],
                conversation: { name: SENDER_ID }
            });
            assert.equal(requestLib.getCall(0).args[0].uri, TEST_URL);
        });

        it('sends nothing, when event does not contain required data', async () => {
            await da.processEvent(daktelaRequest({}));

            assert.strictEqual(requestLib.callCount, 0);
        });

    });

});
