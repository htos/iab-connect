package ch.iabconnect.keycloak;

import org.keycloak.events.Event;
import org.keycloak.events.EventListenerProvider;
import org.keycloak.events.EventType;
import org.keycloak.events.admin.AdminEvent;
import org.keycloak.models.KeycloakSession;
import org.keycloak.models.RealmModel;
import org.keycloak.models.UserModel;
import org.jboss.logging.Logger;

/**
 * Keycloak Event Listener that automatically disables newly registered users.
 * Users must be enabled by an administrator before they can log in.
 */
public class DisableNewUsersEventListener implements EventListenerProvider {

    private static final Logger LOG = Logger.getLogger(DisableNewUsersEventListener.class);

    private final KeycloakSession session;

    public DisableNewUsersEventListener(KeycloakSession session) {
        this.session = session;
    }

    @Override
    public void onEvent(Event event) {
        if (EventType.REGISTER.equals(event.getType())) {
            String userId = event.getUserId();
            String realmId = event.getRealmId();

            LOG.infof("New user registration detected: userId=%s, realmId=%s", userId, realmId);

            RealmModel realm = session.realms().getRealm(realmId);
            if (realm != null) {
                UserModel user = session.users().getUserById(realm, userId);
                if (user != null) {
                    // Disable the user - requires admin approval to enable
                    user.setEnabled(false);

                    // Add the default member role
                    var memberRole = realm.getRole("member");
                    if (memberRole != null && !user.hasRole(memberRole)) {
                        user.grantRole(memberRole);
                    }

                    LOG.infof("User disabled and member role assigned: email=%s, userId=%s. Waiting for admin approval.",
                        user.getEmail(), userId);
                }
            }
        }
    }

    @Override
    public void onEvent(AdminEvent event, boolean includeRepresentation) {
        // Not handling admin events
    }

    @Override
    public void close() {
        // Nothing to close
    }
}
