export type CognitoSessionBridgeStatus =
	| "signed_in"
	| "new_password_required"
	| "validation_error"
	| "verify_email"
	| "invalid_credentials"
	| "missing_profile"
	| "unauthorized_role"
	| "invalid_request";

export type CognitoSignInResponse =
	| {
			status: "signed_in";
			redirectTo: "/student" | "/teacher";
	  }
	| {
			status: "new_password_required";
			message: string;
			challengeSession: string;
			values: {
				email: string;
				password: "";
			};
			errors: Partial<Record<"email" | "password", string[]>>;
	  }
	| {
			status: Exclude<
				CognitoSessionBridgeStatus,
				"signed_in" | "new_password_required"
			>;
			message: string;
			values: {
				email: string;
				password: "";
			};
			errors: Partial<Record<"email" | "password", string[]>>;
	  };

export type CognitoCompleteNewPasswordResponse =
	| {
			status: "signed_in";
			redirectTo: "/student" | "/teacher";
	  }
	| {
			status:
				| "validation_error"
				| "verify_email"
				| "invalid_credentials"
				| "missing_profile"
				| "unauthorized_role"
				| "invalid_request";
			message: string;
			values: {
				email: string;
				password: "";
				confirmPassword: "";
			};
			errors: Partial<Record<"password" | "confirmPassword", string[]>>;
	  };
