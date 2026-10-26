import { emailSubjectEnum } from "../../enum/email.enum.js";

export const emailTemplate = {
  [emailSubjectEnum.CONFIRM_EMAIL]: (otp) => {
    return `<h1>OTP is ${otp}</h1>`;
  },
  [emailSubjectEnum.FORGET_PASSWORD]: (otp) => {
    return `<h1>OTP is ${otp}</h1>`;
  },
};
