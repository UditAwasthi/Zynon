export const passwordResetTemplate = (otp) => {
    return `
    <div style="font-family: Arial, sans-serif;">
      <h2>Password Reset</h2>
      <p>Use the OTP below to reset your password:</p>
      <h1 style="letter-spacing:4px;">${otp}</h1>
      <p>This OTP expires in 10 minutes.</p>
    </div>
  `;
};