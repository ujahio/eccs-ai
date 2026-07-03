export type CognitoSessionBridgeStatus =
	| "signed_in"
	| "validation_error"
	| "verify_email"
	| "invalid_credentials"
	| "missing_profile"
	| "unauthorized_role"
	| "invalid_request";

export type CognitoSignInResponse =
	| {
			status: "signed_in";
			message: string;
			redirectTo: "/student";
	  }
	| {
			status: Exclude<CognitoSessionBridgeStatus, "signed_in">;
			message: string;
			values: {
				email: string;
				password: "";
			};
			errors: Partial<Record<"email" | "password", string[]>>;
	  };

