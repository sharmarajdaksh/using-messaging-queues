If you have had any amount of interest in things like scalable architectures and microservices, there is a good chance you have come across messaging queues. Perhaps you have heard of companies making use of Apache Kafka, or an alternative like RabbitMQ, those two being the most popular messaging queues in use today. And, perhaps, just like me, you were confused by what messaging queues did and how they helped modern distributed architectures. Let's try to understand that.

First things first, let's get the absolute basics out of the way. What even is a messaging queue?

## What is a messaging queue?

Messaging queues or brokers are components used for inter-process communication or for inter-microservice communication, whereby messages between multiple services are passed not through direct transfer of data, but through a common "queue" or buffer in the form of these messaging queues. The paradigm is similar to the publisher/subscriber model, whereby multiple publishers or "producers" push messages into "queues", and subscribers or "consumers" can listen for new messages coming into the queue. As the consumer "consumes" or picks up a message from the queue, the message is removed from the queue. The model is asynchronous in nature, such that the interaction of producers and consumers with the queue is completely independent of one another. 

![Message Queue](MQ1.png)

Maybe you're still confused. Let's try to understand a use cases for such messaging queues to aid your understanding.

## What are some use cases for messaging queues?

As you might have correctly guessed, messaging queues aren't meant for real-time communication. To take a made up, unrealistic scenario, using them as an intermediate, say, for an HTTP request where the user has to wait on the response is probably not a good idea. Using messaging queues in a producer-consumer model gives us no guarantee of when the consumer actually will take up the message for processing. All we have is a guarantee that the message will *eventually* get consumed and processed. *That's not exactly true, because in real-world large-scale systems, things like queue overflows may be a real problem. But for our understanding, we will be assuming a relatively fail-safe system*. Owing to these asynchronous nature, messaging queues are good for processes that are not crucial but nice to have done. The processes which are performed by the consumers should, ideally, not be core to the functioning of the overall architecture and functionality of the application, but they may be processes which help improve the functionality and/or performance of the application. 

Some of the use cases for messaging queues in real-world scenarios today are listed below:

#### Sending emails

Emails are used for a large number of purposes, such marketing campaigns, account verification, password resets, et cetera. If you think about these use cases, you may realize that none of them need immediate processing. Delays in the dispatch of these emails is completely acceptable and does not detract from the core functionality of the applications utilizing emails for various purposes. Message queues can help in such a case. 

![Email](email.png)

* Multiple "producer" service which generate emails and require them to be published can push email objects (by objects I mean some formatted objects that contain all nececssary data such as the content, receiver, subject, etc. for the email) into the queue. 
* A single consumer microservice, dedicated to sending emails, works completely independently of where the email comes from. This service consumes messages from the queue one by one and sends emails as specified in the email object.
* This approach is well scalable, as in case the number of incoming messages to queue gets too large, we may horizontally scale (read: add more number of) consumer email service instances that may all listen to the same queue, sending emails.

#### Data post-processing

Assume you have a Blogging application which needs to handle large amounts of image data, from images uploaded by users themselves. Users can't be expected to provide images which are web-optimized or small in size. However, declining users from uploading certain images due to size may not be the best user experience, and you may want to allow users to upload any images they want if your architecture and storagre capacity is capable of handling it.

One solution for allowing user's flexibility while not impacting the load times of your application negatively (owing to larger assets) is to post-process and optimize all images that are uploaded by the user. This is not at all a crucial operation: while it may impact user experience slightly, the optimization is in no way crucial to the application functionality, nor is it necessary that the action be performed instantly. A service may be employed in the application architecture whose sole purpose is optimizing images that get uploaded on the application. A message queue can help in this scenario. The flow of control and messages for the same may be something like this:
* User publishes a blog post with some high-quality, large images.
* Image gets pushed to storage (something like AWS S3 or Azure Blob Storage).
* A hook is triggered in the application, pushing a message with information on the newly uploaded image into the "image optimization" queue.
* The image optimization service can listen on the queue. It pulls an image from S3, optimizes it, and them reuploads the optimized image to replace the unoptimized one on S3.

#### Batch updates for databases

Databases are used for many purposes. Not all of them are crucial to application usability. Assume you have an application like Spotify. This application may have databases storing user data, which the user can update and/or view at any time. This data is important and any changes in this data may need to be reflected immediately. On the other hand, your application may have a statistical/machine learning engine, which analyzes user actions for any reason, be it for optimizing recommendations or for generating stats. This operation may be considered non-crucial in terms of how immediate the updates need to be. In general, delays in the integration of latest user activity into the machine learning algorithms may we completely acceptable. Here, a message queue may be used for optimizing database querying.

Establishment of a database connection has some overhead irrespective of the amount of data that is transferred. Even if a persistent connection be used, transit times become a factor for large-scale systems. In general, if possible, batching is suggested for operations such as record insertion. In the scenario represented above, each action by the user such as song listen, like, playlist creation, etc. may be used for optimizing user recommendations. However, creating a database request for every single such operation would be insanity, for lack of a better word. 

Instead a better approach may be this:
* For every action, push the action data to a message queue. This will be magnitudes faster than sending the data directly to the database.
* A consumer service may cache these activities' data on a per-user basis as they come into the queue.
  * Caching here is acceptable for two reasons. One, this data is non-critical. Losing this data will not break the application, and the user will neveer be affected or even know. Two, using a cache is much faster for temporary data (Of course cost is also a factor, but let's not dive into that for the purpose of this article).
* On a regular interval, the consuming service may use the cached data, transform it into a single database insertion query, and commit that change to the database.

How the machine learning/data warehousing engine later uses the data is a completely different story, but I hope are able to get a grasp on the several use cases for message queues. Now that you have an idea of the basic concept, let's look into some of the main features of messaging queues.

## Features / Advantages of message queues

* **Decoupling**: Operations of the consumer and producer are completely independent of one another.
* **Scalability**: The number of producers and consumers can easily be scaled as required.
* **Buffering and load management**: Message queues act essentially as data buffers. In case of a spike in the amount of data that needs to be processed by the consumer service, the latter needs not be made aware of the fact. The message queue buffers the data for the service, and the service only needs to process the data one by one, rather than having to manage a large amount of data all at once. This makes your architecture more robust overall.
* **Resiliency**: Even if your consumer processes go down, it doesn't mean that your application breaks. Messages for the consumer will remain queued in the messaging queue. Whenever the consumer service comes back up, it can start processing the messages without having to do any additional setup or work.
* **Delivery guarantees**: Message queues offer a general guarantee that any message that gets pushed to a queue will get delivered to a consumer *eventually*.
* **Order guarantee**: Being a queue, an order is associated to the incoming messages implicitly. The same order is followed in the consumption and processing of the data.

Now, hopefully you have a slightly better understanding of the what and why of messaging queues, compared to when you started reading this article. Now, let's try using a messaging queue in a small application to understand how it would be used in an actual application.

## Using a messaging queue in code

**Disclaimer**: The application that I'll be using is a very simple one, and it honestly does nothing of value. However, it should allow you to understand where a messaging queue may fit into a real application.

The architecture for the application will be something like this:

![App](app.png)

For the messaging queues, I'll be using [RabbitMQ](https://www.rabbitmq.com/), it being one of the easier to use messaging queue systems. The concepts should be transferrable to any other system such as Apache Kafka, which work on the same principles. For the application components, I use docker, and then docker-compose for putting up the containers. For the application code, I use NodeJS in the example. However, of course, the concept will be language agnostic.

### Setup

Let's see the directory structure used for the application. All the code for the repository will be available [here](https://github.com/sharmarajdaksh/using-messaging-queues).
```
|-consumer/
|    |-Dockerfile
|    |-package.json
|    |-app.js
|-producer/
|    |-Dockerfile
|    |-package.json
|    |-app.js
|-secondary_producer/
|    |-Dockerfile
|    |-package.json
|    |-app.js
|-docker-compose.yml
``` 

The package.json file in NodeJS applications is used for managing dependencies and application metadata. The dependencies for the three applications are identical, and the package.json files for each of the three applications is almost identical. You may change the "name" key to match the application, but even that's not mandatory. 
```package.json
{
	"name": "producer",
	"version": "1.0.0",
	"description": "",
	"main": "app.js",
	"scripts": {
		"start": "node app.js",
	},
	"author": "Dakshraj Sharma",
	"license": "ISC",
	"dependencies": {
		"amqplib": "^0.5.6"
	}
}
```

Now, for the Dockerfiles. The Dockerfiles for each of the three applications is exactly the same since they are each nothing but simple NodeJS applications.
```Dockerfile
FROM node:alpine

WORKDIR /usr/app/

COPY ./package*.json ./
RUN npm install

RUN npm install -g pm2

COPY ./ ./

CMD [ "pm2-runtime", "npm", "--", "start" ]
```
This dockerfie does the following things:
* Pulls the node:alpine image
* Creates a directory /usr/app for the application
* Copies to local package.json file to the continer's /usr/app directory and then installs dependencies by running `npm install`.
* Installs pm2 using `npm install -g pm2` to ensure that the application restarts if it errors.
* Copies code file (essentially only app.js) to /usr/app.
* Runs the application using `pm2-runtime npm -- start`.
If you want to learn more about pm2, the [official website](https://pm2.keymetrics.io/) may be a good place to start, but that may be beyond the scope of this article.

Docker compose is responsible for running the four containers of our application together and allow connectivity between them. The content of the docker-compose.yml file is very simple:
```docker-compose.yml
version: '3'
services:
    rabbitmq:
        image: rabbitmq:3.8
        environment:
            RABBITMQ_DEFAULT_USER: rabbitmq
            RABBITMQ_DEFAULT_PASS: rabbitmq
    producer:
        build:
            context: ./producer/
            dockerfile: Dockerfile
        restart: always
        depends_on: 
            - rabbitmq
        environment:
            RABBITMQ_HOST: rabbitmq
            RABBITMQ_USER: rabbitmq
            RABBITMQ_PASS: rabbitmq
            RABBITMQ_QUEUE: messages
        volumes:
            - /usr/app/node_modules
            - ./producer:/usr/app/
    consumer:
        build:
            context: ./consumer/
            dockerfile: Dockerfile
        restart: always
        depends_on: 
            - rabbitmq
        environment:
            RABBITMQ_HOST: rabbitmq
            RABBITMQ_USER: rabbitmq
            RABBITMQ_PASS: rabbitmq
            RABBITMQ_QUEUE: messages
        volumes:
            - /usr/app/node_modules
            - ./consumer/:/usr/app/
    secondary_producer:
        build:
            context: ./secondary_producer/
            dockerfile: Dockerfile
        restart: always
        depends_on: 
            - rabbitmq
        environment:
            RABBITMQ_HOST: rabbitmq
            RABBITMQ_USER: rabbitmq
            RABBITMQ_PASS: rabbitmq
            RABBITMQ_QUEUE: messages
        volumes:
            - /usr/app/node_modules
            - ./secondary_producer:/usr/app/
```

We simply create four `services` or containers.
* A rabbitmq container from the latest rabbitmq image.
  * Password and username for connecting to rabbitmq are passed as environment variables.
    ```
    RABBITMQ_DEFAULT_USER: rabbitmq
    RABBITMQ_DEFAULT_PASS: rabbitmq
    ```
* The service specification for remaining three services is exactly the same, barring the directory paths and service names. 
  * Build from the Dockerfile in the specified path:
  ```
  build:
    context: ./producer/
    dockerfile: Dockerfile
  ```
  * Tell docker-compose to restart the container if it goes down, and that the container should depend on the rabbitmq container.
  ```
  restart: always
  depends_on: 
    - rabbitmq
  ```
  * Set environment variables for the rabbitmq connection (will be used in the code) via `process.env`.
  ```        
  environment:
    RABBITMQ_HOST: rabbitmq
    RABBITMQ_USER: rabbitmq
    RABBITMQ_PASS: rabbitmq
    RABBITMQ_QUEUE: messages
  ```
    * Note the RABBITMQ_HOST variable. In a real-world scenario, this would be replaced by the IP/URL of the machine that is running RabbitMQ. If a local installation is being used, localhost may be specified. Since we are using docker-compose, specifying rabbitmq as an address will automatically be directed to the container/service named rabbitmq.
  * Bookmark /app/node_modules so we do not copy it repeatedly. Also, mount the local files to /usr/app so code changes may be reflected in real time if using nodemon.
  ```
  volumes:
    - /usr/app/node_modules
    - ./producer:/usr/app/
  ```

### The code

Let's write up our first producer, inside `producer/app.js`. To connect with RabbitMQ, we will use the NPM library `amqplib`, which will be available for us to use since it was added as a dependency to our package.json already (see above).
```javascript
const amqp = require('amqplib');
```
We then store the environment variables as local `const` values. Using the host, username, and password variables, we also form the connection string using Javascript template strings and store it as `RABBITMQ_CONNECTION_STRING`.
```javascript
# Host address
const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
# Username
const RABBITMQ_USER = process.env.RABBITMQ_USER;
# Password
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
# Connection string: ampq://username:password@host
const RABBITMQ_CONNECTION_STRING = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/`;

# The name of the queue we will connect to
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE;
```

You might be confused as to why we need to have a queue name value when we already have the host defined. This is because a single RabbitMQ can have many queues, independent of each other. Each of these queues is identified by a string identifier, which we have declared as an environment variable for the current application.

We define a function that returns a random number. In a real world scenario, this may have been any function that supplied some data which had to be passed into the messaging queue.
```javascript
const getRandomNumber = () => {
	return Math.random();
};
```

Fairly basic stuff upto here. Now, let's try to connect to the RabbitMQ instance, set up a queue if one doesn't already exist, and then push in data to the queue. Connection and channel creation are asynchronous and return promises, so we then and catch blocks.

```javascript
amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		console.log('[ Connection Established ] '.toUpperCase());
		//
		// Channel creation is idempotent:
		// A new channel is created only if one doesn't already exist
		//
		return conn.createChannel(); // Create a channel or connection
	})
	.then((chan) => {
		//
		// To send, we must declare a queue for us to send to
        // Here we use a queue named by the value of our RABBITMQ_QUEUE const
        //
		return chan
			.assertQueue(RABBITMQ_QUEUE, {
				durable: false,
			}) // specify queue to send to 
			.then(() => {
				//
				// We can then publish a message to the queue
				// Data is sent as byte streams so any content works
                //
                // The logic here is very simple: 
                // we send a random number into the queue every second
                // A total of 50 times
                // 
				let n = 0;
				let interval = setInterval(() => {
					n++;
					let randomNumber = getRandomNumber();
					chan.sendToQueue(
						RABBITMQ_QUEUE,
						Buffer.from(randomNumber.toString())
					); // Send data into queue

                    // Log the random number to console
					console.log(`[ Sent:     ${randomNumber} ] `.toUpperCase());

					if (n === 50) {
                        // After 50 sends, stop sending
						clearInterval(interval);
					}
				}, 1000);
			});
	})
	.catch((err) => {
        // Catch any errors and log to console
		console.log(err);
	});
```

To summarize what the code is doing:
* Create a new connection to the RabbitMQ instance through
```javascript
amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		return conn.createChannel(); // Create a channel or connection
	})
```
* Create a queue in the channel to send to
```javascript
.then((chan) => {
	return chan
		.assertQueue(RABBITMQ_QUEUE, {
			durable: false,
		}) // specify queue to send to 

``` 
* Send data into the queue
```javascript
.then(() => {
    chan.sendToQueue(
    	RABBITMQ_QUEUE,
    	Buffer.from("ANY MESSAGE HERE");
    );
})
```

For messages to be sent into the queue, any buffered bytes work. So, essentially, you could send a JSON.stringified object into the queue, which could be later parsed at the consumer end as a JSON object.

Now we have a producer up. Let's create the secondary producer in `secondary_producer/app.js` with nearly identical code, which will send a random number into the queue 50 times, every 1.5 second. No explanation should be needed for the code as it is exactly the same as the code for the first producer. Note that we ensure here that the second producer also will send messages to the same queue.

```javascript
const amqp = require('amqplib');

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
const RABBITMQ_CONNECTION_STRING = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/`;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE;

console.log(RABBITMQ_CONNECTION_STRING);

const getRandomNumber = () => {
	return Math.random();
};

amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		console.log('[ Connection Established ] '.toUpperCase());

		return conn.createChannel();
	})
	.then((chan) => {

        return chan
			.assertQueue(RABBITMQ_QUEUE, {
				durable: false,
			})
			.then(() => {
				let n = 0;
				let interval = setInterval(() => {
					n++;
					let randomNumber = getRandomNumber();
					chan.sendToQueue(
						RABBITMQ_QUEUE,
						Buffer.from(randomNumber.toString())
					);

					console.log(`[ Sent:     ${randomNumber} ] `.toUpperCase());

					if (n === 50) {
						clearInterval(interval);
					}
				}, 1500);
			});
	})
	.catch((err) => {
		console.log(err);
	});

```

Now, then, we have two producers that will dump, in total, 100 messages into the queue. Let's now create a consumer for the messages that may do something with the messages.

```javascript
//
// Same declarations as the producer
//
const amqp = require('amqplib');

const RABBITMQ_HOST = process.env.RABBITMQ_HOST;
const RABBITMQ_USER = process.env.RABBITMQ_USER;
const RABBITMQ_PASS = process.env.RABBITMQ_PASS;
const RABBITMQ_CONNECTION_STRING = `amqp://${RABBITMQ_USER}:${RABBITMQ_PASS}@${RABBITMQ_HOST}/`;
const RABBITMQ_QUEUE = process.env.RABBITMQ_QUEUE;

// Counter for total number of consumer messages
let consumer_count = 0;

amqp.connect(RABBITMQ_CONNECTION_STRING)
	.then((conn) => {
		console.log('[ Connection Established ] '.toUpperCase());
        
        // Create channel
		return conn.createChannel();
	})
	.then((chan) => {
		// Declare the queue to consume
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
                            // Increment consumer count
                            consumer_count++;
                            
                            // Log the received value to console
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

```

To summarize what the consumer is doing:
* Environment variables, connection to the RabbitMQ instance, channel creation, and queue specification remains exactly the same as for the producers.
* To consume messages from channel, we use the code:
```javascript
.then(() => {
    // consume messages from specific queue
	chan.consume(RABBITMQ_QUEUE, (message) => {
        // do something with the message
		setTimeout(() => {
			if (message !== null) {
                // Increment consumer count
                consumer_count++;
                
                // Log the received value to console
				console.log(
					`[ RECEIVED: ${message.content.toString()} | COUNT: ${consumer_count} ] `.toUpperCase()
				);
			}
		}, 2000); // Wait for two seconds to simulate some blocking operation
	});
});
```

Something to note here is the fact that we do not use a loop in our consumer. This means that consumer connections work somewhat like websocket connections, whereby the consumer constantly listens on the channel for incoming messages. Whenever the consumer service is free to do work, it reaches into the queue and gets the oldest message (first in queue) and processes it as required. In case there is no message, the consumer will wait on the queue. 

To run the app, run
```
docker-compose up
```
Of course it requires you to have docker and docker-compose installed locally. However, NodeJS and RabbitMQ installations are not needed. (*Why? Because docker is awesome like that*)

Running docker-compose output you'll see an output that looks something like this:

![Output](op-1.png)

Eventually, when all of the messages have been processed, there will be no more console logging. The producers do not send any more data into the queue, and the consumer continues waiting on the queue.

![Output](op-2.png)

If you look hard enough, you'll see how the order of messages being sent and being received is perfectly in line, as expected from the queue. Further, we also see that the consumer works on the messages one by one, independent of how the messages arrive, logging a RECEIVED message exactly every 2 seconds.

That was all for this article. Although I have not discussed complex concepts and strategies used by modern MQ systems like Apache Kafka, such as distributed commit logging and sharding partitioning of queues, you hopefully now have greater insight into what a messaging queue is and can imagine many more use cases where such a system may prove to be useful. Perhaps you could think of how you could integrate an MQ system into your own projects. The principles discussed here should be effectively transferrable to any other MQ system.

Until next time.