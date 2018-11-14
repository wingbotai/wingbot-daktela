# Daktela connector for wingbot.ai

Connector for automating chat conversations on Daktela.

-----------------

# API
<a name="Daktela"></a>

## Daktela
BotService connector for wingbot.ai

**Kind**: global class  

* [Daktela](#Daktela)
    * [new Daktela(processor, options, [senderLogger])](#new_Daktela_new)
    * [.processEvent(body)](#Daktela+processEvent) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
    * [.verifyRequest(body, headers)](#Daktela+verifyRequest) ⇒ <code>Promise</code>

<a name="new_Daktela_new"></a>

### new Daktela(processor, options, [senderLogger])

| Param | Type | Description |
| --- | --- | --- |
| processor | <code>Processor</code> | wingbot Processor instance |
| options | <code>Object</code> |  |
| [options.terminateAction] | <code>string</code> | conversation termination postback |
| [options.pageId] | <code>string</code> | custom page ID |
| [options.requestLib] | <code>function</code> | request library replacement for testing |
| [senderLogger] | <code>console</code> | optional console like chat logger |

<a name="Daktela+processEvent"></a>

### daktela.processEvent(body) ⇒ <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code>
Process Facebook request

**Kind**: instance method of [<code>Daktela</code>](#Daktela)  
**Returns**: <code>Promise.&lt;Array.&lt;{message:Object, pageId:string}&gt;&gt;</code> - - unprocessed events  

| Param | Type | Description |
| --- | --- | --- |
| body | <code>Object</code> | event body |

<a name="Daktela+verifyRequest"></a>

### daktela.verifyRequest(body, headers) ⇒ <code>Promise</code>
Verify Facebook webhook event

**Kind**: instance method of [<code>Daktela</code>](#Daktela)  
**Throws**:

- <code>Error</code> when authorization token is invalid or missing


| Param | Type | Description |
| --- | --- | --- |
| body | <code>Object</code> | parsed request body |
| headers | <code>Object</code> | request headers |

