import { AccountMenu } from "@/features/auth/account-menu";

type TeacherAccountMenuProps = {
	teacherName: string;
};

export function TeacherAccountMenu({ teacherName }: TeacherAccountMenuProps) {
	return (
		<AccountMenu
			items={[
				{
					className: "sm:hidden",
					href: "/teacher",
					label: "Dashboard",
					testId: "teacher-account-menu-dashboard",
				},
				{
					href: "/teacher/profile",
					label: "Profile",
					testId: "teacher-account-menu-profile",
				},
			]}
			logoutButtonTestId="teacher-logout-button"
			logoutErrorTestId="teacher-logout-error"
			menuId="teacher-account-menu"
			menuTestId="teacher-account-menu"
			name={teacherName}
			triggerTestId="teacher-account-menu-trigger"
		/>
	);
}
