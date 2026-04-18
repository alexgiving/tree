# Genealogy Site

This project is a genealogy website that automatically renders a family tree based on provided data. It visualizes relationships between family members, including parents, children, and siblings, and displays their information on an interactive map.

## Project Structure

- **index.html**: The main HTML document that structures the website and includes references to CSS and JavaScript files.
- **styles.css**: Contains styles for the website, defining layout, colors, fonts, and visual aspects of the family tree display.
- **script.js**: Handles the logic for rendering the family tree. It reads data from `data.json`, processes relationships, and dynamically draws connections between family members.
- **data.json**: The data source for the family tree, containing an array of objects representing family members with properties such as name, years of life, place of birth/burial, comments, and relationships.

## Features

- Automatically generates a family tree based on the data provided in `data.json`.
- Displays connections between family members, including lines connecting parents to children and siblings.
- Automatically determines and displays locations on a map based on the place of birth/burial.

## Setup Instructions

1. Clone the repository to your local machine.
2. Open `index.html` in a web browser to view the family tree.
3. Modify `data.json` to add or update family members and their relationships as needed.

## Usage

- To add a new family member, include a new object in the `data.json` file with the required properties.
- Ensure that relationships are correctly defined to visualize the family tree accurately.

## License

This project is open-source and available for modification and distribution.