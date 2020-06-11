const amqp = require('amqplib');

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
const RABBITMQ_CONNECTION_STRING = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/`;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE;

let consumer_count = 0;

amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		console.log('[ Connection Established ] '.toUpperCase());
		//
		// Channel creation is idempotent:
		// A new channel is created only if one doesn't already exist
		//
		return conn.createChannel();
	})
	.then((chan) => {
		//
		// To consume, we must declare the queue
		//
		return chan
			.assertQueue(RABBITMQ_QUEUE, {
				durable: false,
			})
			.then(() => {
				//
				// We can then consume data from a queue
				//
				chan.consume(RABBITMQ_QUEUE, (message) => {
					//
					// Simulate some blocking operation, such as a worker operation
					// Not that of course this will be working asynchronously, meaning
					// that it DOES NOT handle one request every 2 seconds. It just means
					// that each request will take 2 seconds to complete.
					// So, essentially, the last output from the consumer should be
					// ~2 seconds after the last message pushed into the queue by the producer.
					//
					setTimeout(() => {
						if (message !== null) {
							consumer_count++;
							console.log(
								`[ RECEIVED: ${message.content.toString()} | COUNT: ${consumer_count} ] `.toUpperCase()
							);
						}
					}, 2000);
				});
			});
	})
	.catch((err) => {
		console.log(err);
	});
