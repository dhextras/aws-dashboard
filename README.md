# AWS Dashboard

A better dashboard for AWS charges and bills visualization.

## Installation

Follow these steps to set up the AWS dashboard:

1. Clone the repository:
   ```
   git clone https://github.com/dhextras/aws-dashboard.git
   cd aws-dashboard
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. (Optional) Add default billing data:
   - If you want to show initial default billing data, place your `charges.json` file in the `src/data` folder before building the project.

4. Build the project:
   ```
   npm run build
   ```

5. Start the application using PM2 ( In port 4173 ):
   ```
   pm2 start npm -- start --watch
   ```

