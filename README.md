# Why?

As part of preparation for an interview at Pinterest, I thought that it would make a lot of sense to just try and write that beautiful control that's the Face of Pinterest's UI.

I was timeboxed to 8 hours of work, since my actual interviews were the day after I wrote the code. As a result, it's not complete, but it does show a lot about how my brain works.

# Architecture

I did write a server app in ASP.NET Core in C#, which is not part of this repo. In order to keep the Dev Inner Loop as fast as possible, I added a "Fake" server response to the code. This allowed me to literally see my changes happen as soon as I saved the files in VS Code versus needing to do hot updates or redeploys.

On the Client:
  Model - This is the source of all Data that comes from the Server. As mentioned above, the Model can either fetch from my ASP.NET server, or use fake data with fake latency.
  View - These are React controls to display the "Tiles"
  ViewModel - This is the layer between the Model and the View. The data in the Model is agnostic to the platform being used to display the information. When the View needs to get data to display, it asks the ViewModel for the items, passing in some Display Hints to figure out the View-Specific fields (position of the tiles, column, and width). The ViewModel queries the Model, and then using the Display Hints, generates the View Model items that the View can then easily consume.
  
Using the ViewModel layer is also beneficial, because it is possible to write headless tests and validate the View Model items. There would be a seperate set of tests for the View, which would be things like "Can you render this right?" and "Can you handle scrolling right?"

# Issues / Missing Features

- There is a bug that if you scroll down to, say, item 100, and then rapidly scroll up to the top, that you ma see tiles dissapear. This is a race condition of some promises taking a while to complete due to fetching non-cached data, and then when those promises complete, the wrong range is fetched. The fix will be to add some logic to ignore the results from all but the last requested fetch.

- The number of columns in DisplayHints is hardcoded to 3. A to-do will be to watch for the TileGrid control resizing, and if a recalc of the tiles is needed, to make that happen.

- Currently the cache does not prune items that are too far above or below the viewport. This will eventually cause memory issues in the real control, especially if those tiles had a lot of things in them. This is not a terribly complex thing to do, but needs to be done.

- The scrollbar is a bit jumpy when new tiles are rendered. This is because the size of the virtual space is growing. Fixing this will likely involve a bit of playing around with the div's scrolling properties, and making smarter/guessier decisions about changing the size of that virtual space.

# To build and run

- npm install
- npm run build
- npm start

----





# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
