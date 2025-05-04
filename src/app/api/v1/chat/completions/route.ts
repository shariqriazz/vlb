import { NextRequest, NextResponse } from 'next/server'; // Ensure only one import line
// Removed axios import
import targetManager from '@/lib/services/targetManager';
import { logError, requestLogger } from '@/lib/services/logger';
import { readSettings } from '@/lib/settings';
import { v4 as uuidv4 } from 'uuid';
import { RequestLog, RequestLogData } from '@/lib/models/RequestLog';
// Imports for @google-cloud/vertexai SDK
import {
    VertexAI,
    HarmCategory,
    HarmBlockThreshold,
    GenerateContentRequest,
    GenerateContentResponse,
    Content, // Assuming these are exported based on search results
    Part,    // Assuming these are exported based on search results
    FunctionCall, // Assuming this is exported
    FinishReason, // Assuming this is exported
    // Candidate,    // Candidate type might not be directly exported, use response structure
    // GenerateContentResult, // These might be inferred or part of the response type
    // GenerateContentStreamResult,
} from '@google-cloud/vertexai';
// GoogleAuth is not needed for direct credential object usage
// import { GoogleAuth } from 'google-auth-library';

// Define Candidate type based on expected structure within GenerateContentResponse if needed
// Example: type Candidate = GenerateContentResponse['candidates'][0];

// Type alias for stream generator using the SDK's response type
type GenerateContentStreamResponse = AsyncGenerator<GenerateContentResponse>;


// Helper function to handle streaming response (Vertex AI version)
// Update type hint for the stream
// Pass the model requested by the client for response consistency
async function handleStreamingResponseVertex(vertexStream: GenerateContentStreamResponse, requestedModel: string) {
  const encoder = new TextEncoder();
  const streamId = `chatcmpl-${uuidv4()}`;
  const created = Math.floor(Date.now() / 1000);

  const readableStream = new ReadableStream({
    async start(controller) {
      let finishReasonSent: FinishReason | null = null; // Track if a finish reason chunk was sent
      try {
        for await (const item of vertexStream) {
          // Validate chunk structure before accessing properties
          // Use the structure directly if Candidate type isn't imported
          const choice = item?.candidates?.[0];
          const contentPart: Part | undefined | null = choice?.content?.parts?.[0]; // Use Part type
          const textContent: string | undefined | null = contentPart?.text;
          // Ensure currentFinishReason is treated as the enum type or null
          const currentFinishReason: FinishReason | undefined | null = choice?.finishReason; // Use FinishReason type

          // Only send content chunks if there is text
          if (textContent) {
            const chunk = {
              id: streamId,
              object: 'chat.completion.chunk',
              created: created,
              model: requestedModel, // Use requestedModel
              choices: [
                {
                  index: 0,
                  delta: { content: textContent },
                  finish_reason: null, // Finish reason is sent in a separate final chunk if needed
                },
              ],
              // Include usage if available in stream chunks (check Vertex AI docs - usually not available per chunk)
              // usage: item.usageMetadata ? { ... } : undefined
            };
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
          }

          // Check if a final finish reason needs to be sent
          // Compare with the specific enum value for UNSPECIFIED
          // Use the imported FinishReason enum directly
          if (currentFinishReason && currentFinishReason !== FinishReason.FINISH_REASON_UNSPECIFIED && !finishReasonSent) {
             const finalChunk = {
               id: streamId,
               object: 'chat.completion.chunk',
               created: created,
               model: requestedModel, // Use requestedModel
               choices: [
                 {
                   index: 0,
                   delta: {}, // Empty delta in the final chunk
                   finish_reason: mapVertexFinishReason(currentFinishReason), // Map the reason
                 },
               ],
               // Include final usage if available in the last stream item
               usage: item.usageMetadata ? {
                   prompt_tokens: item.usageMetadata.promptTokenCount || 0,
                   completion_tokens: item.usageMetadata.candidatesTokenCount || 0,
                   total_tokens: item.usageMetadata.totalTokenCount || 0,
               } : undefined,
             };
             controller.enqueue(encoder.encode(`data: ${JSON.stringify(finalChunk)}\n\n`));
             finishReasonSent = currentFinishReason; // Mark as sent
          }
          // TODO: Potentially handle function calls delta if needed
        }

        // Send the final DONE message
        controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      } catch (error: any) {
        logError(error, { context: 'Chat completions - Stream Processing Error', modelId: requestedModel }); // Use requestedModel
        // Send an error chunk in the stream
        const errorChunk = {
          id: streamId,
          object: 'chat.completion.chunk',
          created: created,
          model: requestedModel, // Use requestedModel
          choices: [], // No choices on error
          error: {
            message: `Stream error: ${error.message || 'Unknown stream error'}`,
            type: 'stream_error',
            // code: error.code // Optional: include error code if available
          }
        };
         try {
             controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorChunk)}\n\n`));
             // Always close with DONE, even after error chunk
             controller.enqueue(encoder.encode('data: [DONE]\n\n'));
         } catch (enqueueError: any) {
             logError(enqueueError, { context: 'Chat completions - Stream Error Enqueue Failed' });
         } finally {
            // Ensure controller is closed safely
             try {
                 if (controller.desiredSize !== null) controller.close();
             } catch (closeError: any) { /* Ignore */ }
         }
      } finally {
         // Final check to ensure closure
         try {
             if (controller.desiredSize !== null) controller.close();
         } catch (closeError: any) { /* Ignore */ }
      }
    },
     cancel(reason) {
        requestLogger.warn('Stream cancelled by client.', { reason });
        // Handle stream cancellation if necessary (e.g., cleanup resources)
     }
  });

  return new Response(readableStream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      // Add any other necessary headers like CORS if needed from Next.js config
    },
  });
}


// Helper function to translate OpenAI messages to Vertex AI contents format
// Update type hints to use Content and Part from @google-cloud/vertexai
function translateOpenAiToVertexContents(messages: { role: string; content: any }[]): Content[] { // Use Content type
    const contents: Content[] = []; // Use Content type
    let currentContent: Content | null = null; // Use Content type
    let systemPromptContent: string | null = null; // Store system prompt

    messages.forEach((msg, index) => {
        let role: 'user' | 'model'; // Vertex roles are 'user' and 'model'
        let parts: Part[] = []; // Initialize parts array, use Part type

        // --- Role Mapping & System Prompt Handling ---
        if (msg.role === 'system') {
            if (typeof msg.content === 'string') {
                systemPromptContent = (systemPromptContent ? systemPromptContent + "\n\n" : "") + msg.content;
            } else {
                requestLogger.warn("System message content is not a string, cannot reliably process.", { content: msg.content });
            }
            return; // Don't add system message directly to contents array
        } else if (msg.role === 'user') {
            role = 'user';
        } else if (msg.role === 'assistant' || msg.role === 'model') { // Accept 'model' for flexibility
            role = 'model';
        } else if (msg.role === 'function' || msg.role === 'tool') {
             // Handle function/tool responses provided by the client
             if (typeof msg.content === 'string') {
                 try {
                     const functionResponseData = JSON.parse(msg.content);
                     if (functionResponseData.name && functionResponseData.response) {
                         parts = [{ functionResponse: { name: functionResponseData.name, response: functionResponseData.response } }];
                         // The Content role for a function response should be 'user' (or 'tool' if API supports)
                         // representing the result provided back to the model.
                         role = 'user'; // Use 'user' role to provide the function response back to the model
                     } else {
                          requestLogger.warn("Tool/Function response content lacks expected structure (name, response).", { content: msg.content });
                          return; // Skip invalid structure
                     }
                 } catch (e) {
                     requestLogger.warn("Failed to parse Tool/Function response content.", { content: msg.content, error: e });
                     return; // Skip unparsable content
                 }
             } else {
                 requestLogger.warn("Unsupported Tool/Function response content format (must be stringified JSON).", { content: msg.content });
                 return; // Skip non-string tool response
             }
        } else {
            requestLogger.warn(`Unsupported role encountered: ${msg.role}. Skipping message.`);
            return; // Skip unknown roles
        }

        // --- Content Mapping (if not already handled as function response) ---
        if (parts.length === 0) { // Only process if 'parts' wasn't populated by function response logic
            if (typeof msg.content === 'string') {
                let textContent = msg.content;
                if (role === 'user' && systemPromptContent && contents.length === 0) {
                    textContent = `${systemPromptContent}\n\n${textContent}`;
                    systemPromptContent = null; // Clear after prepending
                }
                parts = [{ text: textContent }];
            } else if (Array.isArray(msg.content)) {
                // Handle multimodal content (OpenAI format: array of objects with type 'text' or 'image_url')
                parts = msg.content.map((item: any): Part | null => { // Use Part type
                    if (item.type === 'text') {
                        let textContent = item.text || '';
                        if (role === 'user' && systemPromptContent && contents.length === 0) {
                             textContent = `${systemPromptContent}\n\n${textContent}`;
                             systemPromptContent = null; // Clear after prepending
                        }
                        return { text: textContent };
                    } else if (item.type === 'image_url') {
                        const urlData = item.image_url?.url;
                        if (!urlData) {
                             requestLogger.warn("Image URL data missing.", { item });
                             return null;
                        }
                        const base64Match = urlData.match(/^data:image\/(.*?);base64,(.*)$/);
                        if (base64Match) {
                            return {
                                inlineData: {
                                    mimeType: `image/${base64Match[1]}`,
                                    data: base64Match[2],
                                },
                            };
                        } else {
                             requestLogger.warn("Unsupported image URL format (only base64 data URLs supported).", { url: urlData });
                             return null; // Skip non-base64 URLs
                        }
                    } else {
                         requestLogger.warn("Unsupported content part type in array.", { part: item });
                         return null;
                    }
                }).filter((part): part is Part => part !== null); // Use Part type

                if (parts.length === 0) return; // Skip message if no valid parts remain

            } else if (role === 'model' && typeof msg.content === 'object' && msg.content !== null && msg.content.tool_calls) {
                // Handle tool calls *requested by* the model (OpenAI format)
                parts = (msg.content.tool_calls as any[]).map((toolCall: any): Part | null => { // Use Part type
                    if (toolCall.type === 'function') {
                        if (toolCall.function && typeof toolCall.function.name === 'string' && typeof toolCall.function.arguments === 'string') {
                            try {
                                return {
                                    functionCall: { // Map to Vertex IFunctionCall
                                        name: toolCall.function.name,
                                        args: JSON.parse(toolCall.function.arguments || '{}')
                                    }
                                };
                            } catch (parseError) {
                                 requestLogger.warn(`Failed to parse function arguments for tool call: ${toolCall.function.name}`, { args: toolCall.function.arguments, error: parseError });
                                 return null;
                            }
                        } else {
                             requestLogger.warn(`Invalid function structure in tool call`, { toolCall });
                             return null;
                        }
                    } else {
                        requestLogger.warn(`Unsupported tool call type: ${toolCall.type}`);
                        return null;
                    }
                }).filter((part): part is Part => part !== null); // Use Part type
                if (parts.length === 0) return; // Skip if no valid tool calls found

            } else {
                requestLogger.warn(`Unsupported content type for role ${role}: ${typeof msg.content}. Skipping message.`);
                return; // Skip unsupported content types
            }
        }

        // Ensure parts is defined and not empty
        if (!parts || parts.length === 0) {
             // This should ideally not happen if logic above is correct, but safeguard
             requestLogger.error("Parts array is empty or undefined after processing, skipping message.", { role: role, content: msg.content });
             return;
        }


        // --- Combine consecutive messages from the same role ---
        // Vertex requires alternating roles. Combining is generally discouraged.
        if (currentContent && currentContent.role === role) {
            // Check if the previous part was a function call and current is a function response (both role 'user')
            const prevPartIsFunctionCall = currentContent.parts?.some(p => p.functionCall);
            const currentPartIsFunctionResponse = parts.some(p => p.functionResponse);

            if (role === 'user' && prevPartIsFunctionCall && currentPartIsFunctionResponse) {
                 // This specific sequence (user function call -> user function response) might be invalid for Vertex.
                 // Vertex likely expects model -> user(functionResponse). Log a warning.
                 requestLogger.warn(`Potentially invalid sequence: User message with function call followed immediately by user message with function response.`);
                 // Proceed with creating a new content block anyway, as combining might be worse.
                 currentContent = { role, parts };
                 contents.push(currentContent);
            } else {
                // Standard consecutive role warning
                requestLogger.warn(`Consecutive messages with the same role '${role}' detected. Vertex may expect alternating roles. Creating new content block.`);
                // Create new content block instead of combining
                currentContent = { role, parts };
                contents.push(currentContent);
            }
        } else {
            // If role changes or it's the first message, create a new content object
            currentContent = { role, parts };
            contents.push(currentContent);
        }
    });

    // --- Final Validation ---
    if (contents.length > 0 && contents[0].role !== 'user') {
        requestLogger.warn("Conversation does not start with a user message after translation. Model might reject the request.", { firstRole: contents[0].role });
    }
    for (let i = 1; i < contents.length; i++) {
        const currentRole = contents[i].role;
        const prevRole = contents[i-1].role;
        const prevPartIsFunctionCall = contents[i-1].parts?.some((p: Part) => p.functionCall); // Use Part type
        const currentPartIsFunctionResponse = contents[i].parts?.some((p: Part) => p.functionResponse); // Use Part type

        // Disallow user -> user (unless user is providing function response after model's function call)
        if (currentRole === 'user' && prevRole === 'user' && !currentPartIsFunctionResponse) {
            logError(new Error(`Consecutive 'user' messages detected. Vertex expects alternating roles.`), { context: "translateOpenAiToVertexContents" });
        }
        // Disallow model -> model
        if (currentRole === 'model' && prevRole === 'model') {
            logError(new Error(`Consecutive 'model' messages detected. Vertex expects alternating roles.`), { context: "translateOpenAiToVertexContents" });
        }
        // Ensure model's function call is followed by user's function response
        if (prevRole === 'model' && prevPartIsFunctionCall && !(currentRole === 'user' && currentPartIsFunctionResponse)) {
             logError(new Error(`Model's function call must be followed by a user message containing a function response.`), { context: "translateOpenAiToVertexContents" });
        }
        // Ensure user's function response is followed by model
         if (prevRole === 'user' && currentPartIsFunctionResponse && currentRole !== 'model') {
              logError(new Error(`User's function response must be followed by a model message.`), { context: "translateOpenAiToVertexContents" });
         }
    }

    return contents;
}

// Helper function to map Vertex finish reasons to OpenAI finish reasons
// Accept the FinishReason enum type or null/undefined
function mapVertexFinishReason(vertexReason: FinishReason | null | undefined): string | null {
    if (vertexReason === null || vertexReason === undefined) return null;

    // Use the imported FinishReason enum values for comparison
    switch (vertexReason) {
        case FinishReason.STOP: return 'stop';
        case FinishReason.MAX_TOKENS: return 'length';
        case FinishReason.SAFETY: return 'content_filter';
        case FinishReason.RECITATION: return 'recitation'; // Custom reason for OpenAI
        // case FinishReason.TOOL_CODE: return 'tool_calls'; // TOOL_CODE might not exist, check enum
        case FinishReason.OTHER:
        case FinishReason.FINISH_REASON_UNSPECIFIED:
        default: return null; // Default to null if unknown or unspecified
    }
}


// Helper function to translate Vertex AI response to OpenAI Chat Completion format
// Update type hint to use GenerateContentResponse
// Pass the model requested by the client for response consistency
function translateVertexToOpenAiChatCompletion(vertexResponse: GenerateContentResponse, requestedModel: string): any {
    const completionId = `chatcmpl-${uuidv4()}`;
    const created = Math.floor(Date.now() / 1000);
    // Use the structure directly if Candidate type isn't imported
    const choice = vertexResponse.candidates?.[0];

    if (!choice) {
        logError(new Error("No candidates received from Vertex AI response."), { modelIdUsed: requestedModel }); // Use requestedModel
        return { // Return a valid OpenAI error structure
             id: completionId,
             object: 'chat.completion',
             created: created,
             model: requestedModel, // Use requestedModel
             choices: [{
                 index: 0,
                 message: { role: 'assistant', content: null }, // Null content on error
                 finish_reason: 'error', // Indicate error
             }],
             usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
             error: { message: "No candidates received from Vertex AI", type: "vertex_error" } // Add error info
        };
    }

    // --- Content Extraction ---
    let messageContent: string | null = null;
    let toolCalls: any[] | undefined = undefined;

    if (choice.content?.parts) {
        // Check for function calls first
        const functionCallParts = choice.content.parts.filter((part: Part) => part.functionCall); // Use Part type
        if (functionCallParts.length > 0) {
            toolCalls = functionCallParts.map((part: Part, index: number) => { // Use Part type
                const funcCall = part.functionCall as FunctionCall; // Use FunctionCall type
                return {
                    id: `call_${uuidv4()}_${index}`, // Generate a unique ID for the tool call
                    type: 'function',
                    function: {
                        name: funcCall?.name || `unknown_function_${index}`,
                        arguments: JSON.stringify(funcCall?.args || {}), // OpenAI expects stringified args
                    }
                };
            });
            messageContent = null; // OpenAI expects null content when tool_calls are present
        } else {
            // If no function calls, combine text from all parts that have text
            messageContent = choice.content.parts
                .filter((part: Part) => part.text) // Use Part type
                .map((part: Part) => part.text) // Use Part type
                .join('');
        }
    }

    // --- Usage Data ---
    const usage = {
        prompt_tokens: vertexResponse.usageMetadata?.promptTokenCount ?? 0,
        completion_tokens: vertexResponse.usageMetadata?.candidatesTokenCount ?? 0,
        total_tokens: vertexResponse.usageMetadata?.totalTokenCount ?? 0,
    };

    // --- Finish Reason Mapping ---
    const finishReason = mapVertexFinishReason(choice.finishReason);

    // --- Construct OpenAI Response ---
     const responseChoice = {
         index: 0,
         message: {
             role: 'assistant',
             content: messageContent,
             tool_calls: toolCalls,
         },
         finish_reason: finishReason,
     };

    return {
        id: completionId,
        object: 'chat.completion',
        created: created,
        model: requestedModel, // Use requestedModel
        choices: [responseChoice],
        usage: usage,
    };
}


export async function POST(req: NextRequest) {
  const masterApiKey = process.env.MASTER_API_KEY;

  // --- Master API Key Check ---
  if (masterApiKey) {
    const authHeader = req.headers.get('Authorization');
    const incomingKey = authHeader?.split(' ')[1];
    if (!incomingKey || incomingKey !== masterApiKey) {
      requestLogger.warn('Unauthorized access attempt with Master Key', { path: req.nextUrl.pathname });
      return NextResponse.json(
        { error: { message: 'Unauthorized', type: 'authentication_error' } },
        { status: 401 }
      );
    }
  }
  // --- End Master API Key Check ---

  const settings = await readSettings();
  const maxRetries = settings.maxRetries || 3;

  let retryCount = 0;
  const requestId = uuidv4();
  const startTime = Date.now();
  const ipAddress = req.headers.get('x-forwarded-for') || req.ip || req.headers.get('x-real-ip');

  let body: any;
  try {
    body = await req.json();
  } catch (parseError: any) {
    logError(parseError, { context: 'Chat completions - Body Parsing', requestId });
    const responseTime = Date.now() - startTime;
    await RequestLog.create({
        targetId: 'N/A',
        statusCode: 400,
        isError: true,
        errorType: 'InvalidRequestError',
        errorMessage: 'Failed to parse request body: ' + parseError.message,
        responseTime: responseTime,
        ipAddress: ipAddress || null,
        requestId: requestId,
    }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error' }));
    return NextResponse.json(
      { error: { message: 'Invalid request body', type: 'invalid_request_error' } },
      { status: 400 }
    );
  }
  const isStreaming = body?.stream === true;
  const requestedModel = body?.model as string | undefined; // Get model requested by client

  // --- Validate requestedModel ---
  if (!requestedModel || typeof requestedModel !== 'string') {
      logError(new Error('Missing or invalid "model" parameter in request body.'), { context: 'Chat completions - Body Validation', requestId });
      return NextResponse.json(
          { error: { message: 'Missing or invalid "model" parameter in request body.', type: 'invalid_request_error' } },
          { status: 400 }
      );
  }
  // --- End Validation ---


  requestLogger.info('Incoming Request', {
    requestId,
    path: '/api/v1/chat/completions',
    method: 'POST',
    modelRequested: requestedModel,
    streaming: isStreaming,
    ipAddress: ipAddress,
    userAgent: req.headers.get('user-agent'),
  });

  let targetIdForAttempt: string | null = null;
  let lastError: any = null;

  while (retryCount < maxRetries) {
    let currentTarget: any = null;
    let vertexAI: VertexAI | null = null;

    try {
      // Pass requestedModel to getTarget (targetManager needs update)
      currentTarget = await targetManager.getTarget(requestedModel);
      if (!currentTarget) {
          throw new Error(`No available Vertex AI targets found for model ${requestedModel} or all are currently throttled/disabled.`);
      }
      targetIdForAttempt = currentTarget._id.toString();

      requestLogger.debug(`Attempt ${retryCount + 1}/${maxRetries}: Using target ${targetIdForAttempt}`, { requestId, target: currentTarget });

      // --- Vertex AI Client Instantiation ---
      let serviceAccountCredentials;
      try {
          if (!currentTarget.serviceAccountKeyJson || typeof currentTarget.serviceAccountKeyJson !== 'string') {
              throw new Error(`Service Account Key JSON is missing or invalid for target ${targetIdForAttempt}`);
          }
          serviceAccountCredentials = JSON.parse(currentTarget.serviceAccountKeyJson);
          if (!serviceAccountCredentials.client_email || !serviceAccountCredentials.private_key) {
              throw new Error(`Parsed Service Account Key JSON is missing required fields (client_email, private_key) for target ${targetIdForAttempt}`);
          }
      } catch (e: any) {
          throw new Error(`Failed to parse or validate Service Account JSON for target ${targetIdForAttempt}: ${e.message}`);
      }

      // Initialize VertexAI directly with credentials object
      vertexAI = new VertexAI({
          project: currentTarget.projectId,
          location: currentTarget.location,
          googleAuthOptions: {
              credentials: {
                  client_email: serviceAccountCredentials.client_email,
                  private_key: serviceAccountCredentials.private_key,
              }
              // Optionally add scopes if needed, e.g.:
              // scopes: ['https://www.googleapis.com/auth/cloud-platform']
          }
      });

      // const modelId = currentTarget.modelId; // Removed - use requestedModel

      if (!vertexAI) { // Check added for safety, though unlikely if constructor doesn't throw
          throw new Error("VertexAI client was not initialized correctly.");
      }
      // Use the model requested by the client
      const generativeModel = vertexAI.getGenerativeModel({
          model: requestedModel,
          // safetySettings: [{ category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE }],
      });

      // --- Translate Request ---
      const vertexRequest: GenerateContentRequest = { // Use GenerateContentRequest type
          contents: translateOpenAiToVertexContents(body.messages),
          generationConfig: {
              maxOutputTokens: body.max_tokens,
              temperature: body.temperature,
              topP: body.top_p,
              // topK: body.top_k,
              // stopSequences: body.stop,
          },
          // tools: vertexTools,
      };

      // --- API Call ---
      if (isStreaming) {
        // Type for streamResult can be inferred or use GenerateContentStreamResult if correctly imported/defined
        const streamResult = await generativeModel.generateContentStream(vertexRequest);

        await targetManager.markTargetSuccess(); // Corrected: No arguments

        const responseTime = Date.now() - startTime;
        await RequestLog.create({
            targetId: targetIdForAttempt || 'TARGET_UNAVAILABLE', // Provide fallback
            statusCode: 200,
            isError: false,
            modelUsed: requestedModel, // Log the model actually used
            requestedModel: requestedModel, // Log the model client asked for
            responseTime: responseTime,
            ipAddress: ipAddress || null,
            isStreaming: true,
            requestId: requestId,
        }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error (Stream Success)' }));

        // Pass requestedModel to streaming handler
        return handleStreamingResponseVertex(streamResult.stream, requestedModel);

      } else {
        // Type for result can be inferred or use GenerateContentResult if correctly imported/defined
        const result = await generativeModel.generateContent(vertexRequest);
        const response = result.response;

        await targetManager.markTargetSuccess(); // Corrected: No arguments

        // Pass requestedModel to response translator
        const openAiResponse = translateVertexToOpenAiChatCompletion(response, requestedModel);

        const responseTime = Date.now() - startTime;
        await RequestLog.create({
            targetId: targetIdForAttempt || 'TARGET_UNAVAILABLE', // Provide fallback
            statusCode: 200,
            isError: false,
            modelUsed: requestedModel, // Log the model actually used
            requestedModel: requestedModel, // Log the model client asked for
            promptTokens: response.usageMetadata?.promptTokenCount,
            completionTokens: response.usageMetadata?.candidatesTokenCount,
            totalTokens: response.usageMetadata?.totalTokenCount,
            responseTime: responseTime,
            ipAddress: ipAddress || null,
            isStreaming: false,
            requestId: requestId,
        }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error (Non-Stream Success)' }));

        return NextResponse.json(openAiResponse);
      }

    } catch (error: any) {
      lastError = error;
      const responseTime = Date.now() - startTime;
      let errorMessage = error.message || 'Unknown upstream error';
      let errorType = 'UpstreamError';
      let statusCode = 500;
      let isRetryable = false;

      // --- Enhanced Error Handling & Type Classification ---
      if (error.message?.includes('Service Account JSON') || error.message?.includes('credential')) {
          statusCode = 500;
          errorType = 'ConfigurationError';
          errorMessage = error.message;
          isRetryable = false;
      } else if (error.message?.includes('No available Vertex AI targets')) {
          statusCode = 503;
          errorType = 'NoTargetsAvailableError';
          errorMessage = error.message;
          isRetryable = false;
      } else if (error.details && typeof error.details === 'string' && error.details.includes('quota')) {
           statusCode = 429;
           errorType = 'RateLimitError';
           errorMessage = `Vertex AI Quota Exceeded: ${error.details}`;
           isRetryable = true;
       } else if (error.code) {
          switch (error.code) {
              case 3: statusCode = 400; errorType = 'InvalidRequestError'; errorMessage = `Vertex AI Invalid Argument: ${error.details || error.message}`; isRetryable = false; break;
              case 5: statusCode = 404; errorType = 'NotFoundError'; errorMessage = `Vertex AI Not Found: ${error.details || error.message}`; isRetryable = false; break;
              case 7: statusCode = 403; errorType = 'AuthenticationError'; errorMessage = `Vertex AI Permission Denied: ${error.details || error.message}`; isRetryable = false; break;
              case 8: statusCode = 429; errorType = 'RateLimitError'; errorMessage = `Vertex AI Resource Exhausted (likely quota): ${error.details || error.message}`; isRetryable = true; break;
              case 10: statusCode = 409; errorType = 'ConflictError'; errorMessage = `Vertex AI Aborted: ${error.details || error.message}`; isRetryable = true; break;
              case 13: statusCode = 500; errorType = 'UpstreamServerError'; errorMessage = `Vertex AI Internal Error: ${error.details || error.message}`; isRetryable = true; break;
              case 14: statusCode = 503; errorType = 'UpstreamServiceUnavailableError'; errorMessage = `Vertex AI Service Unavailable: ${error.details || error.message}`; isRetryable = true; break;
              case 16: statusCode = 401; errorType = 'AuthenticationError'; errorMessage = `Vertex AI Unauthenticated: ${error.details || error.message}`; isRetryable = false; break;
              default: errorType = 'UnknownUpstreamError'; errorMessage = `Vertex AI Error (Code ${error.code}): ${error.details || error.message}`; isRetryable = true; break;
          }
      } else if (error instanceof SyntaxError) {
           statusCode = 500;
           errorType = 'UpstreamResponseError';
           errorMessage = `Failed to parse upstream response: ${error.message}`;
           isRetryable = true;
      }

      // Mark the target as having an error
      const wasRateLimitError = await targetManager.markTargetError(error); // Corrected: Pass only error

      await RequestLog.create({
        targetId: targetIdForAttempt || 'TARGET_UNKNOWN', // Use fallback string
        statusCode: statusCode,
        isError: true,
        errorType: errorType,
        errorMessage: errorMessage,
        modelUsed: requestedModel || 'UNKNOWN', // Log the model we attempted to use
        requestedModel: requestedModel, // Log the model client asked for
        responseTime: responseTime,
        ipAddress: ipAddress || null,
        isStreaming: isStreaming,
        requestId: requestId,
      }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error (Attempt Error)' }));

      // Retry logic: Retry only if the error is deemed retryable AND we haven't exceeded max retries.
      // Use the isRetryable flag determined above.
      if (isRetryable && retryCount < maxRetries - 1) {
        retryCount++;
        requestLogger.warn(`Attempt ${retryCount}/${maxRetries} failed for request ${requestId}. Retrying...`, { targetId: targetIdForAttempt, statusCode, errorType, errorMessage });

        // Apply failover delay if this is a rate limit error
        if (errorType === 'RateLimitError') {
          const failoverDelayMs = (settings.failoverDelaySeconds || 0) * 1000;
          if (failoverDelayMs > 0) {
            requestLogger.info(`Applying failover delay of ${settings.failoverDelaySeconds}s before switching targets`, { requestId });
            await new Promise(resolve => setTimeout(resolve, failoverDelayMs));
          }
        } else {
          // For non-rate-limit errors, use the standard retry delay
          await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
        }

        continue;
      } else {
          requestLogger.error(`Final error for request ${requestId} after ${retryCount + 1} attempts. Error: ${errorMessage}`, { targetId: targetIdForAttempt, statusCode, errorType });
          return NextResponse.json(
            { error: { message: errorMessage, type: errorType } },
            { status: statusCode }
          );
      }
    }
  } // End while loop

  // --- Fallback Error Handling ---
  const finalResponseTime = Date.now() - startTime;
  const finalErrorMessage = lastError?.message || 'Maximum retries exceeded without a conclusive error.';
  const finalErrorType = 'MaxRetriesExceeded';
  const finalStatusCode = 500; // Default to 500 for max retries fallback

  logError(new Error(finalErrorMessage), {
    context: 'Chat completions - Max Retries Fallback',
    requestId,
    retryCount,
    statusCode: finalStatusCode,
    streaming: isStreaming,
    responseTime: finalResponseTime,
    modelRequested: requestedModel,
    lastTargetId: targetIdForAttempt,
    errorType: finalErrorType,
    originalError: lastError?.toString()
  });

  await RequestLog.create({
    targetId: targetIdForAttempt || 'TARGET_UNKNOWN', // Use fallback string
    statusCode: finalStatusCode,
    isError: true,
    errorType: finalErrorType,
    errorMessage: finalErrorMessage,
    modelUsed: requestedModel || 'UNKNOWN', // Log the model we attempted to use
    requestedModel: requestedModel, // Log the model client asked for
    responseTime: finalResponseTime,
    ipAddress: ipAddress || null,
    isStreaming: isStreaming,
    requestId: requestId,
  }).catch(dbError => logError(dbError, { context: 'RequestLog DB Write Error (Fallback Error)' }));

  return NextResponse.json(
    { error: { message: finalErrorMessage, type: finalErrorType } },
    { status: finalStatusCode }
  );
}