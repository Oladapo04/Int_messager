// Int-Messager v4.11.3 — Vite 8 / Rolldown code-splitting snippet.
//
// Merge the `build` object below into your existing vite.config.js.
// Do not replace your existing plugins, dev-server proxy, aliases, or other settings.

build: {
  rolldownOptions: {
    output: {
      codeSplitting: {
        minSize: 20000,
        groups: [
          {
            name: "react-vendor",
            test: /node_modules[\\/](react|react-dom)[\\/]/,
            priority: 30,
          },
          {
            name: "socket-vendor",
            test: /node_modules[\\/](socket\.io-client|engine\.io-client)[\\/]/,
            priority: 25,
          },
          {
            name: "vendor",
            test: /node_modules/,
            priority: 10,
            maxSize: 250000,
          },
        ],
      },
    },
  },
},
