export type CreatePendingStudentInput = {
	emailNormalized: string;
	firstName: string;
	lastName: string;
	password: string;
};

export type CreatePendingStudentResult = {
	cognitoSub: string;
};

export class StudentAlreadyExistsError extends Error {
	constructor() {
		super("A student account already exists for this email.");
		this.name = "StudentAlreadyExistsError";
	}
}

export interface RegistrationIdentityProvider {
	createPendingStudent(
		input: CreatePendingStudentInput
	): Promise<CreatePendingStudentResult>;
	confirmStudentEmail(args: {
		emailNormalized: string;
		firstName: string;
		lastName: string;
	}): Promise<void>;
	deletePendingStudent(emailNormalized: string): Promise<void>;
}
