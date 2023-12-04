# GraphQL Extractor

VS Code extension to extract GraphQL queries from files and generate client-side queries and TypeScript types code for them..

## Features

- Generate client queries from gql scheam  
- Generate typescript types from gql scheam  
- Generate apis function from gql scheam  
- User can create `gql-extract.config.json` file to using some futures

## Usage

Open your `workspace folder` and follow the steps:

- First step: Type `CTRL+Shift+P`.
- Second step: Type `gql extract` and press `Enter`.
- Third step: Wait while your queries files and types files to be generated.

The extension wil create two folders:

1. `queries folder`: for all client queries files.
2. `types folder`: for types files.

### config file

You can create `gql-extract.config.json` file in the root of your project to:

- choose where the types must be saved.
- choose where the queries must be saved.
- set the apis option `"apollo"` to create apis functions.

I'll add other apis option soon, inshallah.

Example for config file:

```json
{
  "queriesFolderName": "FOLDER_NAME",
  "typesFolderName": "FOLDER_NAME",
  "apisFolderName": "FOLDER_NAME if you set the apis option",
  "apis": "apollo"
}
```

**Enjoy!**
