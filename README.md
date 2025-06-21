# GraphQL Extractor

VS Code extension to extract GraphQL queries from files and generate client-side queries and TypeScript types code for them..

## Features

- Generate client queries from gql scheam  
- Generate typescript types from gql scheam  
- Generate apis function from gql scheam  
- User can create `gql-extract.config.json` file to using some futures
- Handle recursive types with configurable recursion depth

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
- choose where the apis function must be saved.
- set the apis option `"apollo"` to create apis functions.
- set apollo fetchPolicy `"fetchPolicy"`, the default value is "no-cache".
- set recursion depth with `"recursionDepth"` (default is 5)
- set type-specific recursion depths with `"typeRecursionMap"` for handling specific recursive types

I'll add other apis option soon, inshallah.

Example for config file:

```json
{
  "queriesFolderName": "FOLDER_NAME",
  "typesFolderName": "FOLDER_NAME",
  "apisFolderName": "FOLDER_NAME if you set the apis option",
  "apis": "apollo",
  "fetchPolicy": "no-cache",
  "recursionDepth": 3,
  "typeRecursionMap": {
    "TemplateObject": 2,
    "NestedType": 4
  }
}
```

In this example, most recursive types will be traversed to a depth of 3, but TemplateObject will be limited to 2 levels and NestedType will go to 4 levels deep.

**Enjoy!**
