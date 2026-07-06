import { AccountMenu } from "@/features/auth/account-menu";

type StudentAccountMenuProps = {
	studentName: string;
};

export function StudentAccountMenu({ studentName }: StudentAccountMenuProps) {
	return (
		<AccountMenu
			items={[
				{
					className: "sm:hidden",
					href: "/student",
					label: "Dashboard",
					testId: "student-account-menu-dashboard",
				},
				{
					className: "sm:hidden",
					href: "/student",
					label: "Certificates",
					testId: "student-account-menu-certificates",
				},
				{
					href: "/student/profile",
					label: "Profile",
					testId: "student-account-menu-profile",
				},
				{
					className: "hidden sm:block",
					href: "/student",
					label: "Case studies",
					testId: "student-account-menu-cases",
				},
			]}
			logoutButtonTestId="student-logout-button"
			logoutErrorTestId="student-logout-error"
			menuId="student-account-menu"
			menuTestId="student-account-menu"
			name={studentName}
			triggerTestId="student-account-menu-trigger"
		/>
	);
}
