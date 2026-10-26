import {
  deleteCacheValue as deleteCacheKey,
  getCacheValue,
  getConfirmEmailBanKey,
  getConfirmEmailKey,
  getConfirmEmailTrialsKey,
  isExists,
  setCacheValue,
  ttl,
} from "../../commen/cache/cache.service.js";
import { emailSubjectEnum } from "../../commen/enum/email.enum.js";
import {
  badRequestException,
  conflictExceptions,
  notFoundException,
  unauthorizedException,
} from "../../commen/exceptions/exceptions.js";
import { encryptValue } from "../../commen/security/encryption.js";
import { compareValue, hashValue } from "../../commen/security/hashing.js";
import { createLoginTokens } from "../../commen/security/tokens.js";
import { emailEvents } from "../../commen/utils/email/email.event.js";
import { GOOGLE_CLIENT_ID } from "../../config/config.js";
import { userModel } from "../../DB/model/user.model.js";
import { createDoc, findOneDoc } from "../../DB/repo.js";

export async function signup(data) {
  const { email } = data;
  const user = await findOneDoc({ model: userModel, filter: { email } });

  if (user) {
    throw conflictExceptions({ errmsg: "Email already exists" });
  }

  data.password = await hashValue(data.password);
  if (data.phoneNumber) {
    data.phoneNumber = encryptValue(data.phoneNumber);
  }

  await createDoc({ model: userModel, data });

  emailEvents.emit("send-OTP", {
    email,
    subject: emailSubjectEnum.CONFIRM_EMAIL,
  });
}

export async function confirmEmail(bodyData) {
  const { email, otp } = bodyData;

  const user = await findOneDoc({
    model: userModel,
    filter: { email, confirmEmail: false },
  });

  if (!user) {
    throw notFoundException();
  }

  const hashedOTP = await getCacheValue(getConfirmEmailKey(email));

  if (!hashedOTP) {
    throw badRequestException();
  }

  const isOTPValid = await compareValue(otp, hashedOTP);
  if (!isOTPValid) {
    throw badRequestException();
  }

  user.confirmEmail = true;
  await user.save();
  await deleteCacheKey(getConfirmEmailKey(email));
}

export async function resendConfirmEmail(email) {
  const user = await findOneDoc({
    model: userModel,
    filter: { email, confirmEmail: false },
  });

  const old_OTP_TTL = await ttl(getConfirmEmailKey(email));

  if (old_OTP_TTL > 0) {
    throw badRequestException({ errMsg: `Old OTP stil valid ${old_OTP_TTL}s` });
  }

  const userTrials = await getCacheValue(getConfirmEmailTrialsKey(email));
  if (userTrials >= 3) {
    await setCacheValue(getConfirmEmailBanKey(email), 0, {
      expiration: { type: "EX", value: 15 * 60 },
    });
  }

  const isBanned = await isExists(getConfirmEmailBanKey(email));
  if (isBanned) {
    throw badRequestException({ errMsg: "Please try again later" });
  }

  if (!user) {
    throw notFoundException();
  }

  emailEvents.emit("send-OTP", {
    email,
    subject: emailSubjectEnum.CONFIRM_EMAIL,
  });
}

export async function login(data) {
  const { email, password } = data;
  const user = await findOneDoc({ model: userModel, filter: { email } });

  if (!user) {
    throw unauthorizedException({ errMsg: "Invalid email or password" });
  }

  if (!user.confirmEmail) {
    throw unauthorizedException();
  }

  const isMatch = await compareValue(password, user.password);
  if (!isMatch) {
    throw unauthorizedException({ errMsg: "Invalid email or password" });
  }

  return createLoginTokens({ user });
}

/////////////////////////////////
import { OAuth2Client } from "google-auth-library";
const client = new OAuth2Client();
async function verify(token) {
  const ticket = await client.verifyIdToken({
    idToken: token,
    audience: GOOGLE_CLIENT_ID,
  });
  return ticket.getPayload();
}

export async function signupOrLoginWithGoogle(idToken) {
  const result = await verify(idToken);

  if (!result.email_verified) {
    throw unauthorizedException();
  }

  const user = findOneDoc({
    model: userModel,
    filter: { email: result.email },
  });
  if (user) {
    if (user.provider === userProviderEnum.SYSTEM) {
      throw badRequestException({ errmsg: "you need to login using password" });
    }
    if (user.provider === userProviderEnum.GOOGLE) {
      return { statusCode: 200, tokens: createLoginTokens({ user }) };
    }
  }

  const [newUser] = await createDoc({
    model: userModel,
    insertData: {
      username: `${result.given_name} ${result.family_name}`,
      email: result.email,
      provider: userProviderEnum.GOOGLE,
      confirmEmail: true,
    },
  });

  return { statusCode: 201, tokens: createLoginTokens({ newUser }) };
}

export async function sendOTPForgetPassword(email) {
  const user = await findOneDoc({
    model: userModel,
    filter: { email, confirmEmail: true },
  });

  if (!user) {
    throw notFoundException();
  }

  emailEvents.emit("send-OTP", {
    email,
    subject: emailSubjectEnum.FORGET_PASSWORD,
  });
}
